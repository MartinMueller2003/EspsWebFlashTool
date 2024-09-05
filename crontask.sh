#!/bin/bash
NumTasks=($(ps -A | grep -v grep | grep npm | wc -l))
echo "Numtasks $NumTasks"
if [ $NumTasks -ne 0 ]; then
  echo "Process is running."
else
  echo "Process is not running. Starting Process"
  MyPath=$(dirname $(readlink -f "$0"))
  (cd $MyPath; npm run start &)
fi
