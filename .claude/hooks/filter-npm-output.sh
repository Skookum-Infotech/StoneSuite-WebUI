#!/usr/bin/env bash
# Reads vitest / vite build output on stdin and drops only lines that are never
# needed to act on a failure: passing test files, emitted dist assets, and
# repeated blank lines. Failures, errors and summaries pass through untouched.
awk '
  /^[[:space:]]*(✓|√)[[:space:]]/            { passed++; next }
  /^[[:space:]]*dist\/.*kB/                   { assets++; next }
  /^[[:space:]]*$/ { if (blank++) next; print; next }
  { blank = 0; print }
  END {
    if (passed) printf "(hid %d passing test file line(s))\n", passed
    if (assets) printf "(hid %d emitted asset line(s))\n", assets
  }
'
