#!/bin/bash
P=$'\033[38;5;111m$\033[0m '
typeit(){ printf "%s" "$P"; local s="$1"; for ((i=0;i<${#s};i++)); do printf '%s' "${s:$i:1}"; sleep 0.045; done; printf '\n'; }
sleep 0.6
typeit "maude --version"; maude --version; sleep 1.1
typeit "maude init --dry-run --name recipe-recap"; maude init --dry-run --name recipe-recap 2>&1 | head -14; sleep 1.8
typeit "maude design help"; maude design help 2>&1 | head -20; sleep 2.5
