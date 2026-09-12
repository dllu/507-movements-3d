# Local review artifacts

The review scripts write source comparisons, geometry/contact reports, sampled
trajectories, browser traces, and historical snapshots here. The existing local
archive is retained; bulk generated output is excluded from Git. Review notes
in `review/*.md` are versioned, and their evidence links refer to that local
archive. Production geometry and playback data live in `src/data/`, so the app
and numerical test suite do not require this archive.

Use the scripts in `scripts/` to reproduce individual studies. Some historical
studies depend on earlier local artifacts; those scripts are preserved as
research records. The runnable app and the numerical tests use checked-in
source and data.

Source snapshots are immutable. Some identical large archive copies share a
hard link to save local disk space; live sources and original reports are not
linked to them. Preserve snapshots in place and write new evidence under a
fresh name. Consolidation inventories record the preserved paths and hashes.
