# Glass to Pixel

An interactive isometric figure of one iPhone tap, built with the anatomy skill in `.claude/skills/anatomy`.

```sh
node build.mjs            # iphone-tap.html (dark)
node build.mjs --light    # iphone-tap-light.html
node make-artifact.mjs iphone-tap.html glass-to-pixel.html   # theme-aware page for publishing
```

Timings come from a simple 120 Hz model in `build.mjs` (`STAGES`), not from Apple specs. Display layers are drawn about 3× thick and pixels about 35× large.
