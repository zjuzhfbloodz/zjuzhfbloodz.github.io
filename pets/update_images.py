#!/usr/bin/env python3
import json
import re
import sys

with open("images-data.js", "r") as f:
    content = f.read()

# Find the JSON part
match = re.search(r'const petImagesData = (\{.*\});$', content, re.DOTALL)
if not match:
    print("ERROR: Could not find JSON data")
    sys.exit(1)

json_str = match.group(1)

try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    print(f"ERROR: JSON parse error: {e}")
    sys.exit(1)

new_entry = {
    "date": "2026-03-18",
    "time": "09:06",
    "img": "/images/pets/20260318-090616-BD0673744.jpg",
    "type": "other",
    "found": False,
    "boxedImg": None,
    "analysis": "image: 图像模糊，无法确定是否有人/猫/狗; YOLO: 无检测",
    "petIdentity": None,
    "yoloClasses": [],
    "decisionSource": "both"
}

# Insert at beginning of 2026-03-18 array
if "2026-03-18" not in data["images"]:
    data["images"]["2026-03-18"] = []
data["images"]["2026-03-18"].insert(0, new_entry)

# Recalculate stats
total = 0
person = 0
cat = 0
dog = 0
for date_key in data["images"]:
    for img in data["images"][date_key]:
        total += 1
        if img.get("type") == "person":
            person += 1
        elif img.get("type") == "cat":
            cat += 1
        elif img.get("type") == "dog":
            dog += 1

data["stats"] = {"totalImages": total, "personCount": person, "catCount": cat, "dogCount": dog}

# Write back
new_content = "const petImagesData = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\nexport default petImagesData;"

with open("images-data.js", "w") as f:
    f.write(new_content)

print("Updated successfully")
print("Stats:", data["stats"])
