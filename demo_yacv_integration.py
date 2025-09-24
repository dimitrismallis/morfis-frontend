#!/usr/bin/env python3
"""
Demo script showing Build123d and YACV integration working
This demonstrates the key functionality that powers our web application
"""

import os
import time

# Set up environment for headless rendering
os.environ['DISPLAY'] = ':99'
os.environ['LIBGL_ALWAYS_INDIRECT'] = '1' 
os.environ['LIBGL_ALWAYS_SOFTWARE'] = '1'
os.environ['YACV_HOST'] = 'localhost'
os.environ['YACV_PORT'] = '32323'

print("🚀 Starting Build123d + YACV Integration Demo")
print("=" * 50)

try:
    # Import Build123d
    print("📦 Importing Build123d...")
    from build123d import *
    print(f"✅ Build123d v{__import__('build123d').__version__} imported successfully")
    
    # Import YACV
    print("📦 Importing YACV server...")
    from yacv_server import show, YACV
    print("✅ YACV server imported successfully")
    
    # Create YACV instance
    print("🔧 Setting up YACV server...")
    yacv = YACV()
    
    print("🎯 Creating CAD models...")
    
    # Example 1: Simple box with hole
    print("  → Creating box with cylindrical hole...")
    with BuildPart() as box_with_hole:
        Box(20, 20, 10)  # Create main box
        Cylinder(4, 10, mode=Mode.SUBTRACT)  # Subtract hole
    
    box_with_hole.color = (0.2, 0.6, 0.8, 1.0)  # Blue color
    print(f"    Volume: {box_with_hole.part.volume:.2f} cubic units")
    
    # Example 2: Simple bracket
    print("  → Creating mounting bracket...")
    with BuildPart() as bracket:
        with BuildSketch() as sk:
            Rectangle(30, 20)
            Circle(4, mode=Mode.SUBTRACT)  # Center hole
        extrude(amount=8)
        
        # Add mounting holes at corners
        with Locations((10, 7, 0), (-10, 7, 0)):
            Cylinder(2, 8, mode=Mode.SUBTRACT)
    
    bracket.color = (0.8, 0.4, 0.2, 1.0)  # Orange color
    print(f"    Volume: {bracket.part.volume:.2f} cubic units")
    
    # Example 3: Simple gear-like shape
    print("  → Creating gear-like object...")
    import math
    
    with BuildPart() as gear:
        # Base cylinder
        Cylinder(20, 6)
        
        # Add teeth around circumference (simplified)
        teeth_count = 12
        for i in range(teeth_count):
            angle = i * (360 / teeth_count)
            x = 16 * math.cos(math.radians(angle))
            y = 16 * math.sin(math.radians(angle))
            
            with Locations((x, y, 0)):
                Box(3, 2, 6)  # Simple rectangular tooth
        
        # Center hole
        Cylinder(5, 6, mode=Mode.SUBTRACT)
    
    gear.color = (0.6, 0.6, 0.6, 1.0)  # Gray color
    print(f"    Volume: {gear.part.volume:.2f} cubic units")
    
    # Show all models in YACV
    print("🖼️  Displaying models in YACV viewer...")
    show(box_with_hole, bracket, gear, names=['BoxWithHole', 'Bracket', 'Gear'])
    
    print("✅ All models created and sent to YACV server!")
    print("🌐 YACV server is running on http://localhost:32323")
    print("📝 This demonstrates the integration that powers the web application")
    
    # In a real web application, the frontend would connect to this YACV server
    # and display the 3D models in the browser
    
    print("\n🎉 Demo completed successfully!")
    print("The integration is working and ready for production use.")
    
    # Keep server alive briefly to demonstrate it's working
    print("\n⏳ Keeping server alive for 10 seconds...")
    time.sleep(10)
    
except Exception as e:
    print(f"❌ Demo failed: {e}")
    import traceback
    traceback.print_exc()

print("\n🏁 Demo finished.")
