#!/usr/bin/env bash

ref=$1 # Reference name
old=$2 # Current commit for reference
new=$3 # Proposed new commit for reference

RED="\033[0;31m"
GREEN="\033[0;32m"
NO_COLOUR="\033[0m"

# This is an update to a branch other than master, so not checked any further
if [ "$ref" != "refs/heads/master" ]; then
    exit 0
fi

# For every new commit on master, check there are two parents
# 2 parents indicates this is a merge commit and that's fine
# 1 parent indicates this is a direct commit to master and that's not ok.
for commit in `git rev-list --first-parent $new ^$old`
do
    # ... check that there is more than one parent
    parents=`git log --pretty=%P -n 1 $commit`
    num_parents=`echo ${parents} | wc -w`
    if [ 1 -eq ${num_parents} ]; then
        echo -n "REJECT: "
        echo -e "${RED}Denying direct push to origin/master$NO_COLOUR"
        echo ""
        exit 1
    fi
done
