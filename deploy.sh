#!/usr/bin/env bash
set -e

npm install
npm run build
rsync -a --delete dist/ pupserver.linode:/www/507movements3d.com/
