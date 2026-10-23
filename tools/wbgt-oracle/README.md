# WBGT oracle

`wbgt.c` is Liljegren's original WBGT v1.1 C code from Argonne National Laboratory. It's unchanged, with its license at the top. We use it only to check `engine/src/wbgt.ts`; it doesn't ship in the app.

- Source: [mdljts/wbgt](https://github.com/mdljts/wbgt) `src/wbgt.c.original`, commit `cd672a8`, via the copy kept in [zyf0717/lwbgt](https://github.com/zyf0717/lwbgt) `upstream/wbgt.c.original`.
- Required line: "This product includes software produced by UChicago Argonne, LLC under Contract No. DE-AC02-06CH11357 with the Department of Energy."

`driver.c` reads one case per line from stdin and prints `status est_speed Tg Tnwb Tpsy Twbg`.

## Regenerate the test fixture

You only need this if you change the cases in `make-fixtures.mjs`. The fixture is committed, so `npm test` works without a C compiler.

1. Get GCC. On Windows, [w64devkit](https://github.com/skeeto/w64devkit/releases) works without installing anything.
2. Build. The original is 1990s K&R C, so it has to be compiled as C89:

   ```sh
   gcc -std=gnu89 -O2 -fno-fast-math -ffp-contract=off -w -Dmain=orig_main -c wbgt.c -o wbgt.o
   gcc -std=gnu89 -w -c driver.c -o driver.o
   gcc wbgt.o driver.o -o oracle -lm
   ```

3. From the repo root: `node tools/wbgt-oracle/make-fixtures.mjs tools/wbgt-oracle/oracle`

Tiny C Compiler (tcc) on 64-bit Windows passes K&R `float` arguments wrongly, and every case fails. Use GCC.

## Result (Oct 14, 2026)

418 cases: a full July day in Kissimmee plus 400 seeded cases across 8 US cities, all seasons, 2 m and 10 m wind, day and night. Largest difference from the C code: **0.02 °C** (requirement: 0.5 °C). The C uses 32-bit floats and the port uses 64-bit doubles, which accounts for the difference.
