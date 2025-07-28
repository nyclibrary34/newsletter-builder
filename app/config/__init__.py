"""
Configuration management for the newsletter builder application.
"""

from .settings import Config, DevelopmentConfig, ProductionConfig, get_config

__all__ = ['Config', 'DevelopmentConfig', 'ProductionConfig', 'get_config']
