#!/bin/bash
NumTasks=($(ps -A | grep -v grep | grep npm | wc -l))
if [ $? -eq 0 ]; then
  echo "Process is running."
else
  echo "Process is not running."
  npm run start &
fi
