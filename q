[33mcommit e54cd4929356e8679ee3e22bcbf9b847b60a8064[m[33m ([m[1;36mHEAD -> [m[1;32mwip-not-working[m[33m, [m[1;31morigin/wip-not-working[m[33m)[m
Author: Ejiro Pinnock <epinnock@gmail.com>
Date:   Tue Nov 4 03:03:26 2025 +0000

    fix(cloudflare): resolve entry-point errors across directories
    
    Update wrangler.toml main path to use relative syntax (./worker.ts)
    to fix "Missing entry-point" errors when running from different
    locations. Add dev:cloudflare:local npm script for running wrangler
    from project root with explicit config path. Update QUICKSTART and
    README to document all three development methods and troubleshooting.

[33mcommit cd373fba6e86a7ebf2d9feaac3e596c9475de946[m
Author: Ejiro Pinnock <epinnock@gmail.com>
Date:   Tue Nov 4 02:21:56 2025 +0000

    wip: not working

[33mcommit a9ab90fcf2f8463ec32d1a090bb77fdf9eac0b6f[m[33m ([m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m, [m[1;32mmain[m[33m)[m
Author: Ejiro Pinnock <epinnock@gmail.com>
Date:   Thu Oct 30 04:52:59 2025 +0000

    commit before path based routing

[33mcommit 18bbbead7feb3c9c00d5ab1e99c4b5df0a75ef91[m
Author: Ejiro Pinnock <epinnock@gmail.com>
Date:   Wed Oct 15 18:56:41 2025 +0000

    updated for r2 vs s3

[33mcommit 33cd56c5bbda1ca9a557057e16809e16aec42f6b[m
Author: Ejiro Pinnock <epinnock@gmail.com>
Date:   Wed Oct 15 18:48:28 2025 +0000

    init project
