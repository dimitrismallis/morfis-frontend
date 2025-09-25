"""
Morfis Custom YACV - Yet Another CAD Viewer
Customized version of YACV for Morfis application with UI modifications.
"""

import os

from .cad import image_to_gltf
from .yacv import YACV

__version__ = "0.10.10-morfis"

# Create a global YACV instance similar to the original yacv_server
_yacv_instance = None


def _get_yacv_instance():
    """Get or create the global YACV instance"""
    global _yacv_instance
    if _yacv_instance is None:
        _yacv_instance = YACV()
    return _yacv_instance


def show(*objs, names=None, **kwargs):
    """
    Shows the given CAD objects in the frontend. This is a convenience function 
    that calls show() on the global YACV instance.
    """
    return _get_yacv_instance().show(*objs, names=names, **kwargs)


def clear():
    """Clear all objects from the viewer"""
    return _get_yacv_instance().clear()


def remove(*names):
    """Remove specific objects by name"""
    return _get_yacv_instance().remove(*names)


def export_all(folder, **kwargs):
    """Export all objects to a folder"""
    return _get_yacv_instance().export_all(folder, **kwargs)


__all__ = ["YACV", "show", "clear", "remove", "export_all", "image_to_gltf"]
