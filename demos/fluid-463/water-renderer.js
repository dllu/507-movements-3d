import * as THREE from 'three';

const screenVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const particleVertex = `
  uniform float radius; uniform float pixelScale;
  attribute float speed; varying vec3 center; varying float velocity;
  void main(){vec4 p=modelViewMatrix*vec4(position,1.);center=p.xyz;velocity=speed;
    gl_Position=projectionMatrix*p;gl_PointSize=2.*radius*pixelScale/max(.1,-p.z);}`;
const sphereFragment = `
  uniform float radius; uniform mat4 projection; uniform sampler2D sceneDepth;
  uniform vec2 resolution; uniform float cameraNear; uniform float cameraFar;
  varying vec3 center; varying float velocity;
  float linearDepth(float d){return cameraNear*cameraFar/(cameraFar-d*(cameraFar-cameraNear));}
  void main(){vec2 xy=gl_PointCoord*2.-1.;xy.y=-xy.y;float r2=dot(xy,xy);if(r2>1.)discard;
    float nz=sqrt(1.-r2);vec3 p=center+vec3(xy,nz)*radius;
    float depth=-p.z;float solid=linearDepth(texture2D(sceneDepth,gl_FragCoord.xy/resolution).r);
    if(depth>=solid||-center.z>solid+radius*.12)discard;
    vec4 clip=projection*vec4(p,1.);gl_FragDepth=(clip.z/clip.w)*.5+.5;
    #ifdef THICKNESS
    gl_FragColor=vec4(min(2.*radius*nz,solid-depth),0.,0.,1.);
    #else
    gl_FragColor=vec4(depth,velocity,0.,1.);
    #endif
  }`;
const blurFragment = `
  uniform sampler2D source;uniform vec2 direction;varying vec2 vUv;
  void main(){vec4 center=texture2D(source,vUv);if(center.r<.001){gl_FragColor=center;return;}
    vec2 sum=vec2(0.);float weights=0.;
    for(int i=-12;i<=12;i++){vec2 p=texture2D(source,vUv+direction*float(i)).rg;
      if(p.r<.001)continue;float d=(p.r-center.r)*3.;float s=float(i)/8.;
      float w=exp(-d*d-s*s);sum+=p*w;weights+=w;}
    gl_FragColor=vec4(sum/max(weights,.001),0.,1.);}`;
const compositeFragment = `
  varying vec2 vUv;uniform sampler2D sceneColor;uniform sampler2D sceneDepth;uniform sampler2D fluidDepth;
  uniform sampler2D thickness;uniform vec2 texel;uniform mat4 projection;uniform mat4 cameraWorld;
  uniform float cameraNear;uniform float cameraFar;
  float linearDepth(float d){return cameraNear*cameraFar/(cameraFar-d*(cameraFar-cameraNear));}
  vec3 viewPoint(vec2 uv,float depth){return vec3((uv*2.-1.)*depth/vec2(projection[0][0],projection[1][1]),-depth);}
  float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.27,.37));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  void main(){
    vec3 background=texture2D(sceneColor,vUv).rgb;vec2 fluid=texture2D(fluidDepth,vUv).rg;float d=fluid.x;
    float solid=linearDepth(texture2D(sceneDepth,vUv).r);
    if(d<.001||d>=solid-.006){gl_FragColor=vec4(background,1.);}
    else{
      vec3 p=viewPoint(vUv,d);
      float left=texture2D(fluidDepth,vUv-vec2(texel.x,0.)).r;
      float right=texture2D(fluidDepth,vUv+vec2(texel.x,0.)).r;
      float down=texture2D(fluidDepth,vUv-vec2(0.,texel.y)).r;
      float up=texture2D(fluidDepth,vUv+vec2(0.,texel.y)).r;
      if(left<.001)left=d+.2;if(right<.001)right=d+.2;if(down<.001)down=d+.2;if(up<.001)up=d+.2;
      vec3 dx=abs(right-d)<abs(left-d)?viewPoint(vUv+vec2(texel.x,0.),right)-p:p-viewPoint(vUv-vec2(texel.x,0.),left);
      vec3 dy=abs(up-d)<abs(down-d)?viewPoint(vUv+vec2(0.,texel.y),up)-p:p-viewPoint(vUv-vec2(0.,texel.y),down);
      vec3 n=normalize(cross(dx,dy));if(n.z<0.)n=-n;
      vec3 world=(cameraWorld*vec4(p,1.)).xyz;
      vec3 normal=normalize(mat3(cameraWorld)*n);vec3 eye=normalize(-p);
      float depth=clamp(texture2D(thickness,vUv).r*.58,.025,3.);
      vec2 refracted=clamp(vUv+n.xy*.016*min(depth,1.),texel,vec2(1.)-texel);
      if(linearDepth(texture2D(sceneDepth,refracted).r)<d)refracted=vUv;
      vec3 behind=texture2D(sceneColor,refracted).rgb;
      vec3 transmission=exp(-vec3(2.5,.95,.76)*depth);
      vec3 tint=vec3(.025,.15,.12);
      vec3 refractedColor=behind*transmission+tint*(1.-transmission);
      vec3 reflected=reflect(normalize(mat3(cameraWorld)*p),normal);
      vec3 sky=mix(vec3(.27,.34,.30),vec3(.80,.91,.87),smoothstep(-.15,.65,reflected.y));
      float light=pow(max(0.,dot(reflected,normalize(vec3(-.5,1.,.2)))),110.);
      sky+=vec3(1.,.96,.84)*light*2.;
      float fresnel=.035+.965*pow(1.-max(0.,dot(n,eye)),5.);
      vec3 color=mix(refractedColor,sky,clamp(fresnel,.035,.92));
      float glint=pow(max(0.,dot(normal,normalize(vec3(-.25,1.,.3)))),28.);
      color+=glint*vec3(.10,.13,.12);
      float speck=hash(floor(world*95.));
      float foam=smoothstep(2.8,5.,fluid.y)*(1.-smoothstep(.05,.20,depth))*.16;
      color=mix(color,vec3(.87,.94,.90),foam);
      color=mix(background,color,smoothstep(.012,.09,depth));
      gl_FragColor=vec4(color,1.);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class WaterRenderer {
  constructor(renderer, camera, capacity) {
    this.renderer=renderer;this.camera=camera;
    const makeTarget=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.sceneTarget=makeTarget();
    this.sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.depthTarget=makeTarget();this.blurA=makeTarget();this.blurB=makeTarget();this.thicknessTarget=makeTarget();
    for(const target of [this.depthTarget,this.blurA,this.blurB])target.texture.type=THREE.FloatType;
    this.positions=new Float32Array(capacity*3);this.speeds=new Float32Array(capacity);
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('speed',new THREE.BufferAttribute(this.speeds,1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms={radius:{value:.15},pixelScale:{value:1},projection:{value:camera.projectionMatrix},
      sceneDepth:{value:this.sceneTarget.depthTexture},resolution:{value:new THREE.Vector2(1,1)},cameraNear:{value:camera.near},cameraFar:{value:camera.far}};
    this.depthMaterial=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:particleVertex,fragmentShader:sphereFragment});
    this.thicknessMaterial=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:particleVertex,fragmentShader:sphereFragment,
      defines:{THICKNESS:1},transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false});
    this.debugMaterial=new THREE.PointsMaterial({color:0x268b8a,size:.09,sizeAttenuation:true});
    this.particles=new THREE.Points(this.geometry,this.depthMaterial);this.particles.frustumCulled=false;
    this.particleScene=new THREE.Scene();this.particleScene.add(this.particles);
    this.screenScene=new THREE.Scene();this.screenCamera=new THREE.Camera();
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);this.quad.frustumCulled=false;this.screenScene.add(this.quad);
    this.blurMaterial=new THREE.ShaderMaterial({vertexShader:screenVertex,fragmentShader:blurFragment,depthTest:false,depthWrite:false,
      uniforms:{source:{value:null},direction:{value:new THREE.Vector2()}}});
    this.composite=new THREE.ShaderMaterial({vertexShader:screenVertex,fragmentShader:compositeFragment,depthTest:false,depthWrite:false,
      uniforms:{sceneColor:{value:this.sceneTarget.texture},sceneDepth:{value:this.sceneTarget.depthTexture},
        fluidDepth:{value:this.blurB.texture},thickness:{value:this.thicknessTarget.texture},texel:{value:new THREE.Vector2()},
        projection:{value:camera.projectionMatrix},cameraWorld:{value:camera.matrixWorld},cameraNear:{value:camera.near},cameraFar:{value:camera.far}}});
  }
  resize(width,height) {
    this.width=width;this.height=height;
    for(const target of [this.sceneTarget,this.depthTarget,this.blurA,this.blurB,this.thicknessTarget])target.setSize(width,height);
    this.uniforms.resolution.value.set(width,height);
    this.composite.uniforms.texel.value.set(1/width,1/height);
  }
  update(fluid) {
    this.positions.set(fluid.positions.subarray(0,fluid.count*3));
    for(let i=0;i<fluid.count;i++)this.speeds[i]=Math.hypot(fluid.velocities[i*3],fluid.velocities[i*3+1],fluid.velocities[i*3+2]);
    this.geometry.setDrawRange(0,fluid.count);
    this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.speed.needsUpdate=true;
    this.uniforms.radius.value=fluid.spacing*.90;
    this.uniforms.pixelScale.value=this.height/(2*Math.tan(this.camera.fov*Math.PI/360));
    this.debugMaterial.size=fluid.spacing*.75;
  }
  render(scene, mode='water') {
    const r=this.renderer,camera=this.camera;
    const oldColor=r.getClearColor(new THREE.Color()),oldAlpha=r.getClearAlpha();
    r.setRenderTarget(mode==='particles'?null:this.sceneTarget);r.render(scene,camera);
    if(mode==='particles') {
      this.particles.material=this.debugMaterial;r.autoClear=false;r.render(this.particleScene,camera);r.autoClear=true;return;
    }
    r.setClearColor(0x000000,0);
    this.particles.material=this.depthMaterial;r.setRenderTarget(this.depthTarget);r.clear();r.render(this.particleScene,camera);
    this.particles.material=this.thicknessMaterial;r.setRenderTarget(this.thicknessTarget);r.clear();r.render(this.particleScene,camera);
    this.quad.material=this.blurMaterial;
    this.blurMaterial.uniforms.source.value=this.depthTarget.texture;this.blurMaterial.uniforms.direction.value.set(1/this.width,0);
    r.setRenderTarget(this.blurA);r.render(this.screenScene,this.screenCamera);
    this.blurMaterial.uniforms.source.value=this.blurA.texture;this.blurMaterial.uniforms.direction.value.set(0,1/this.height);
    r.setRenderTarget(this.blurB);r.render(this.screenScene,this.screenCamera);
    // A second pair removes the individual particle silhouettes from contiguous water.
    this.blurMaterial.uniforms.source.value=this.blurB.texture;this.blurMaterial.uniforms.direction.value.set(1/this.width,0);
    r.setRenderTarget(this.blurA);r.render(this.screenScene,this.screenCamera);
    this.blurMaterial.uniforms.source.value=this.blurA.texture;this.blurMaterial.uniforms.direction.value.set(0,1/this.height);
    r.setRenderTarget(this.blurB);r.render(this.screenScene,this.screenCamera);
    this.quad.material=this.composite;r.setRenderTarget(null);r.render(this.screenScene,this.screenCamera);
    r.setClearColor(oldColor,oldAlpha);
  }
}
