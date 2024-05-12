#!/usr/bin/env python3

# Wrapper to call esptool, stripped down from the Arduino ESP8266 project.

import sys
import os

sys.argv.pop(0) # Remove executable name
toolspath = os.path.dirname(os.path.realpath(__file__)).replace('\\', '/') # CWD in UNIX format
# print("\ntoolspath: '" + toolspath + "'\n")

esptoolPath = os.path.join(toolspath, "esptool")
#print("\nesptoolPath: '" + esptoolPath + "'\n")
pyserialPath = os.path.join(toolspath, "pyserial")
#print("\npyserialPath: '" + pyserialPath + "'\n")
sys.path.insert(0, esptoolPath) # Add esptool dir to search path
sys.path.insert(0, pyserialPath) # Add pyserial dir to search path
print(sys.path)

try:
    import esptool # If this fails, we can't continue and will bomb below
except:
    sys.stderr.write("\nesptool directory not found next to this upload.py tool.\n")
#    sys.exit(1)

esptool.main(sys.argv)

