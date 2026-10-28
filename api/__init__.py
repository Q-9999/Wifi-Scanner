# MMQ./WifiScanner API Package
import sys
import os

API_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(API_DIR, ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from .server import app

__all__ = ["app"]
