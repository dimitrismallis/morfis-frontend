#!/usr/bin/env python3
"""
Test script to verify Build123d and YACV integration
"""

import os
import sys


def test_build123d_import():
    """Test if Build123d can be imported"""
    try:
        import build123d
        print("✅ Build123d imported successfully")
        print(
            f"   Build123d version: {build123d.__version__ if hasattr(build123d, '__version__') else 'unknown'}")
        return True
    except ImportError as e:
        print(f"❌ Failed to import Build123d: {e}")
        return False


def test_yacv_import():
    """Test if YACV server can be imported"""
    try:
        import yacv_server
        print("✅ YACV server imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Failed to import YACV server: {e}")
        return False


def test_simple_build123d_script():
    """Test a simple Build123d script"""
    try:
        import build123d
        from build123d import Box, BuildPart

        # Create a simple box
        with BuildPart() as box:
            Box(10, 10, 5)

        print("✅ Simple Build123d script executed successfully")
        print(f"   Created box with volume: {box.part.volume}")
        return True
    except Exception as e:
        print(f"❌ Failed to execute Build123d script: {e}")
        return False


def test_yacv_basic_functionality():
    """Test basic YACV functionality"""
    try:
        # Set environment to disable server auto-start for testing
        os.environ['YACV_DISABLE_SERVER'] = '1'

        from build123d import Box, BuildPart
        from yacv_server import YACV

        # Create YACV instance
        yacv = YACV()

        # Create a simple object
        with BuildPart() as test_part:
            Box(5, 5, 2)

        # Test showing the object (without starting server)
        yacv.show(test_part)

        print("✅ YACV basic functionality test passed")
        return True
    except Exception as e:
        print(f"❌ YACV basic functionality test failed: {e}")
        return False


if __name__ == "__main__":
    print("🧪 Testing Build123d and YACV integration...")
    print("-" * 50)

    tests = [
        test_build123d_import,
        test_yacv_import,
        test_simple_build123d_script,
        test_yacv_basic_functionality,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
        print("-" * 50)

    print(f"\n📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Build123d and YACV integration is working.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        sys.exit(1)
