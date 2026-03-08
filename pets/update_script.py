#!/usr/bin/env python3
import re

# Read the file
with open('images-data.js', 'r') as f:
    content = f.read()

# Find the position after the opening bracket of 2026-03-08 array
# Look for the pattern: "2026-03-08": [\n      {
pattern = r'("2026-03-08": \[\n      \{)'

new_entry = '''\\1
        "date": "2026-03-08",
        "time": "19:30",
        "img": "/images/pets/20260308-193005-BD0673744.jpg",
        "type": "other",
        "boxedImg": "/images/pets/annotated/20260308-193005-BD0673744.jpg",
        "analysis": "image视觉识别和YOLO目标检测均未检测到人/猫/狗。图片模糊，整体呈灰色调，无明显特征。",
        "petIdentity": null,
        "yoloClasses": [],
        "decisionSource": "both"
      },'''

# This is complex, let's try a simpler approach
# Just use awk to insert after line 28
