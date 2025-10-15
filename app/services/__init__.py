"""
Business logic services for the newsletter builder application.

Modules are imported lazily to avoid import errors when optional service modules
are not present in the current deployment.
"""

from importlib import import_module

__all__ = []


def _register(service_module: str, class_name: str) -> None:
    try:
        module = import_module(f".{service_module}", __name__)
        globals()[class_name] = getattr(module, class_name)
        __all__.append(class_name)
    except (ImportError, AttributeError):
        # Optional service is not available in this environment.
        pass


_register("storage", "StorageService")
_register("newsletter", "NewsletterService")
_register("image", "ImageService")
_register("pdf", "PDFService")
