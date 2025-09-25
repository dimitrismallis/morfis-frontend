#!/usr/bin/env python3
"""
Simple standalone test to verify YACV + Build123d integration works
This bypasses all Flask complexity and tests the core functionality
"""

import sys
import os
sys.path.insert(0, '/workspace')

# Set up headless rendering environment
os.environ['DISPLAY'] = ':99'
os.environ['LIBGL_ALWAYS_INDIRECT'] = '1'
os.environ['LIBGL_ALWAYS_SOFTWARE'] = '1'

print("🧪 Testing YACV + Build123d integration...")

try:
    # Test 1: Import Build123d
    print("1. Importing Build123d...")
    from build123d import *
    print("   ✅ Build123d imported successfully")
    
    # Test 2: Import YACV
    print("2. Importing YACV...")
    from yacv_custom import YACV, show
    print("   ✅ YACV imported successfully")
    
    # Test 3: Create YACV instance
    print("3. Creating YACV instance...")
    yacv_instance = YACV()
    print("   ✅ YACV instance created")
    
    # Test 4: Start YACV server
    print("4. Starting YACV server...")
    yacv_instance.start()
    print("   ✅ YACV server started")
    
    # Test 5: Create Build123d model
    print("5. Creating Build123d model...")
    with BuildPart() as p:
        Box(1, 1, 1)
    test_box = p.part
    print("   ✅ Build123d box created")
    
    # Test 6: Show model in YACV
    print("6. Showing model in YACV...")
    show(test_box, name="TestBox")
    print("   ✅ Model shown in YACV")
    
    # Test 7: Check if model appears in YACV
    print("7. Checking YACV objects...")
    objects = yacv_instance.shown_object_names()
    print(f"   📋 YACV objects: {objects}")
    
    if "TestBox" in objects:
        print("   ✅ Model successfully registered in YACV!")
        print(f"   🌐 YACV server running on: http://localhost:{yacv_instance.port}")
        print("   🎯 You can open this URL to see the 3D model!")
    else:
        print("   ❌ Model not found in YACV objects")
        
    print("\n🎉 Test completed! If all steps passed, the integration works!")
    print("The issue is likely in Flask routing, not the core functionality.")
    
except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
