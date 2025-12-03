#!/usr/bin/env python3
"""
BrainDriveWhyDetector Plugin Lifecycle Manager

Handles install/update/delete operations for the BrainDriveWhyDetector plugin
using BrainDrive's multi-user plugin lifecycle management architecture.
"""

import json
import logging
import datetime
import os
import shutil
import asyncio
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import structlog

logger = structlog.get_logger()

# Import the base lifecycle manager
try:
    from app.plugins.base_lifecycle_manager import BaseLifecycleManager
    logger.info("BrainDriveWhyDetector: Using BaseLifecycleManager from app.plugins")
except ImportError:
    try:
        import sys
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_path = os.path.join(current_dir, "..", "..", "..", "..", "app", "plugins")
        backend_path = os.path.abspath(backend_path)
        
        if os.path.exists(backend_path):
            if backend_path not in sys.path:
                sys.path.insert(0, backend_path)
            from base_lifecycle_manager import BaseLifecycleManager
            logger.info(f"BrainDriveWhyDetector: Using BaseLifecycleManager from: {backend_path}")
        else:
            # Minimal implementation for remote installations
            logger.warning(f"BrainDriveWhyDetector: BaseLifecycleManager not found, using minimal implementation")
            from abc import ABC, abstractmethod
            from datetime import datetime
            from pathlib import Path
            from typing import Set
            
            class BaseLifecycleManager(ABC):
                """Minimal base class for remote installations"""
                def __init__(self, plugin_slug: str, version: str, shared_storage_path: Path):
                    self.plugin_slug = plugin_slug
                    self.version = version
                    self.shared_path = shared_storage_path
                    self.active_users: Set[str] = set()
                    self.instance_id = f"{plugin_slug}_{version}"
                    self.created_at = datetime.now()
                    self.last_used = datetime.now()
                
                async def install_for_user(self, user_id: str, db, shared_plugin_path: Path):
                    if user_id in self.active_users:
                        return {'success': False, 'error': 'Plugin already installed for user'}
                    result = await self._perform_user_installation(user_id, db, shared_plugin_path)
                    if result['success']:
                        self.active_users.add(user_id)
                        self.last_used = datetime.now()
                    return result
                
                async def uninstall_for_user(self, user_id: str, db):
                    if user_id not in self.active_users:
                        return {'success': False, 'error': 'Plugin not installed for user'}
                    result = await self._perform_user_uninstallation(user_id, db)
                    if result['success']:
                        self.active_users.discard(user_id)
                        self.last_used = datetime.now()
                    return result
                
                @abstractmethod
                async def get_plugin_metadata(self): pass
                @abstractmethod
                async def get_module_metadata(self): pass
                @abstractmethod
                async def _perform_user_installation(self, user_id, db, shared_plugin_path): pass
                @abstractmethod
                async def _perform_user_uninstallation(self, user_id, db): pass
            
            logger.info("BrainDriveWhyDetector: Using minimal BaseLifecycleManager implementation")
            
    except ImportError as e:
        logger.error(f"BrainDriveWhyDetector: Failed to import BaseLifecycleManager: {e}")
        raise ImportError("BrainDriveWhyDetector plugin requires BaseLifecycleManager")


class BrainDriveWhyDetectorLifecycleManager(BaseLifecycleManager):
    """Lifecycle manager for BrainDriveWhyDetector plugin"""
    
    def __init__(self, plugins_base_dir: str = None):
        """Initialize the lifecycle manager"""
        # Plugin metadata
        self.plugin_data = {
            "name": "BrainDriveWhyDetector",
            "description": "Find Your Why - Multi-agent coaching flow to discover your core purpose",
            "version": "1.0.2",
            "type": "frontend",
            "icon": "Target",
            "category": "coaching",
            "official": False,
            "author": "BrainDrive Community",
            "compatibility": "1.0.0",
            "scope": "BrainDriveWhyDetector",
            "bundle_method": "webpack",
            "bundle_location": "dist/remoteEntry.js",
            "is_local": False,
            "long_description": "A guided coaching experience using AI to help you discover your personal Why - your core purpose and what truly drives you. Features multi-phase discovery, pattern recognition, and Why statement generation.",
            "plugin_slug": "BrainDriveWhyDetector",
            "source_type": "github",
            "source_url": "https://github.com/navaneethkrishnansuresh/whyfinder-v1",
            "update_check_url": "https://github.com/navaneethkrishnansuresh/whyfinder-v1/releases/latest",
            "last_update_check": None,
            "update_available": False,
            "latest_version": None,
            "installation_type": "remote",
            "permissions": ["api.access"]
        }
        
        # Module metadata
        self.module_data = [
            {
                "name": "BrainDriveWhyDetector",
                "display_name": "Why Discovery Coach",
                "description": "Guided coaching session to discover your personal Why through structured conversation",
                "icon": "Target",
                "category": "coaching",
                "priority": 1,
                "props": {},
                "config_fields": {
                    "coach_model": {
                        "type": "text",
                        "description": "Preferred model for coach agent",
                        "default": ""
                    },
                    "auto_save_session": {
                        "type": "boolean",
                        "description": "Automatically save session progress",
                        "default": True
                    }
                },
                "messages": {},
                "required_services": {
                    "api": {"methods": ["get", "post", "postStreaming"], "version": "1.0.0"},
                    "theme": {"methods": ["getCurrentTheme", "addThemeChangeListener", "removeThemeChangeListener"], "version": "1.0.0"},
                    "pluginState": {"methods": ["save", "load"], "version": "1.0.0"}
                },
                "dependencies": [],
                "layout": {
                    "minWidth": 6,
                    "minHeight": 6,
                    "defaultWidth": 10,
                    "defaultHeight": 8
                },
                "tags": ["why", "coaching", "purpose", "self-discovery", "ai"]
            }
        ]
        
        # Determine shared path
        logger.info(f"BrainDriveWhyDetector: plugins_base_dir - {plugins_base_dir}")
        if plugins_base_dir:
            shared_path = Path(plugins_base_dir) / "shared" / self.plugin_data['plugin_slug'] / f"v{self.plugin_data['version']}"
        else:
            shared_path = Path(__file__).parent
        logger.info(f"BrainDriveWhyDetector: shared_path - {shared_path}")
        
        super().__init__(
            plugin_slug=self.plugin_data['plugin_slug'],
            version=self.plugin_data['version'],
            shared_storage_path=shared_path
        )
    
    @property
    def PLUGIN_DATA(self):
        """Compatibility property for remote installer validation"""
        return self.plugin_data
    
    async def get_plugin_metadata(self) -> Dict[str, Any]:
        """Return plugin metadata"""
        return self.plugin_data
    
    async def get_module_metadata(self) -> list:
        """Return module definitions"""
        return self.module_data
    
    async def _perform_user_installation(self, user_id: str, db: AsyncSession, shared_plugin_path: Path) -> Dict[str, Any]:
        """Perform user-specific installation"""
        try:
            db_result = await self._create_database_records(user_id, db)
            if not db_result['success']:
                return db_result
            
            # Create plugin page
            page_result = await self._create_plugin_page(user_id, db, db_result['modules_created'])
            if not page_result.get('success'):
                # Rollback plugin records if page creation fails
                plugin_id = db_result.get('plugin_id')
                if plugin_id:
                    await self._delete_database_records(user_id, plugin_id, db)
                return page_result
            
            logger.info(f"BrainDriveWhyDetector: User installation completed for {user_id}")
            return {
                'success': True,
                'plugin_id': db_result['plugin_id'],
                'plugin_slug': self.plugin_data['plugin_slug'],
                'plugin_name': self.plugin_data['name'],
                'modules_created': db_result['modules_created'],
                'page_id': page_result.get('page_id'),
                'page_created': page_result.get('created', False)
            }
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: User installation failed for {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _perform_user_uninstallation(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Perform user-specific uninstallation"""
        try:
            existing_check = await self._check_existing_plugin(user_id, db)
            if not existing_check['exists']:
                return {'success': False, 'error': 'Plugin not found for user'}
            
            plugin_id = existing_check['plugin_id']
            
            # Delete plugin page first
            page_result = await self._delete_plugin_page(user_id, db)
            if not page_result.get('success'):
                return page_result
            
            delete_result = await self._delete_database_records(user_id, plugin_id, db)
            if not delete_result['success']:
                return delete_result
            
            logger.info(f"BrainDriveWhyDetector: User uninstallation completed for {user_id}")
            return {
                'success': True,
                'plugin_id': plugin_id,
                'deleted_modules': delete_result['deleted_modules'],
                'page_deleted': page_result.get('deleted_rows', 0) > 0
            }
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: User uninstallation failed for {user_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _copy_plugin_files_impl(self, user_id: str, target_dir: Path, update: bool = False) -> Dict[str, Any]:
        """Copy plugin files to target directory"""
        try:
            source_dir = Path(__file__).parent
            copied_files = []
            
            exclude_patterns = {
                'node_modules', 'package-lock.json', '.git', '.gitignore',
                '__pycache__', '*.pyc', '.DS_Store', 'Thumbs.db'
            }
            
            def should_copy(path: Path) -> bool:
                for part in path.parts:
                    if part in exclude_patterns:
                        return False
                for pattern in exclude_patterns:
                    if '*' in pattern and path.name.endswith(pattern.replace('*', '')):
                        return False
                return True
            
            for item in source_dir.rglob('*'):
                if item.name == 'lifecycle_manager.py' and item == Path(__file__):
                    continue
                    
                relative_path = item.relative_to(source_dir)
                
                if not should_copy(relative_path):
                    continue
                
                target_path = target_dir / relative_path
                
                try:
                    if item.is_file():
                        target_path.parent.mkdir(parents=True, exist_ok=True)
                        if update and target_path.exists():
                            target_path.unlink()
                        shutil.copy2(item, target_path)
                        copied_files.append(str(relative_path))
                    elif item.is_dir():
                        target_path.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    logger.warning(f"BrainDriveWhyDetector: Failed to copy {relative_path}: {e}")
                    continue
            
            # Copy lifecycle_manager.py
            lifecycle_manager_source = source_dir / 'lifecycle_manager.py'
            lifecycle_manager_target = target_dir / 'lifecycle_manager.py'
            if lifecycle_manager_source.exists():
                lifecycle_manager_target.parent.mkdir(parents=True, exist_ok=True)
                if update and lifecycle_manager_target.exists():
                    lifecycle_manager_target.unlink()
                shutil.copy2(lifecycle_manager_source, lifecycle_manager_target)
                copied_files.append('lifecycle_manager.py')
            
            logger.info(f"BrainDriveWhyDetector: Copied {len(copied_files)} files to {target_dir}")
            return {'success': True, 'copied_files': copied_files}
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error copying plugin files: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _validate_installation_impl(self, user_id: str, plugin_dir: Path) -> Dict[str, Any]:
        """Validate plugin installation"""
        try:
            required_files = ["package.json", "dist/remoteEntry.js"]
            missing_files = []
            
            for file_path in required_files:
                if not (plugin_dir / file_path).exists():
                    missing_files.append(file_path)
            
            if missing_files:
                return {
                    'valid': False,
                    'error': f"BrainDriveWhyDetector: Missing required files: {', '.join(missing_files)}"
                }
            
            # Validate package.json
            package_json_path = plugin_dir / "package.json"
            try:
                with open(package_json_path, 'r') as f:
                    package_data = json.load(f)
                
                required_fields = ["name", "version"]
                for field in required_fields:
                    if field not in package_data:
                        return {
                            'valid': False,
                            'error': f'BrainDriveWhyDetector: package.json missing field: {field}'
                        }
                        
            except (json.JSONDecodeError, FileNotFoundError) as e:
                return {
                    'valid': False,
                    'error': f'BrainDriveWhyDetector: Invalid package.json: {e}'
                }
            
            # Validate bundle
            bundle_path = plugin_dir / "dist" / "remoteEntry.js"
            if bundle_path.stat().st_size == 0:
                return {
                    'valid': False,
                    'error': 'BrainDriveWhyDetector: Bundle file is empty'
                }
            
            logger.info(f"BrainDriveWhyDetector: Validation passed for user {user_id}")
            return {'valid': True}
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error validating installation: {e}")
            return {'valid': False, 'error': str(e)}
    
    async def _get_plugin_health_impl(self, user_id: str, plugin_dir: Path) -> Dict[str, Any]:
        """Check plugin health"""
        try:
            health_info = {
                'bundle_exists': False,
                'bundle_size': 0,
                'package_json_valid': False
            }
            
            bundle_path = plugin_dir / "dist" / "remoteEntry.js"
            if bundle_path.exists():
                health_info['bundle_exists'] = True
                health_info['bundle_size'] = bundle_path.stat().st_size
            
            package_json_path = plugin_dir / "package.json"
            if package_json_path.exists():
                try:
                    with open(package_json_path, 'r') as f:
                        json.load(f)
                    health_info['package_json_valid'] = True
                except json.JSONDecodeError:
                    pass
            
            is_healthy = (
                health_info['bundle_exists'] and 
                health_info['bundle_size'] > 0 and
                health_info['package_json_valid']
            )
            
            return {
                'healthy': is_healthy,
                'details': health_info
            }
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error checking health: {e}")
            return {
                'healthy': False,
                'details': {'error': str(e)}
            }
    
    async def _check_existing_plugin(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Check if plugin exists for user"""
        try:
            plugin_slug = self.plugin_data['plugin_slug']
            
            plugin_query = text("""
            SELECT id, name, version, enabled, created_at, updated_at, plugin_slug
            FROM plugin
            WHERE user_id = :user_id AND plugin_slug = :plugin_slug
            """)
            
            result = await db.execute(plugin_query, {
                'user_id': user_id,
                'plugin_slug': plugin_slug
            })
            
            plugin_row = result.fetchone()
            if plugin_row:
                return {
                    'exists': True,
                    'plugin_id': plugin_row.id,
                    'plugin_info': {
                        'id': plugin_row.id,
                        'name': plugin_row.name,
                        'version': plugin_row.version,
                        'enabled': plugin_row.enabled,
                        'created_at': plugin_row.created_at,
                        'updated_at': plugin_row.updated_at
                    }
                }
            else:
                return {'exists': False}
                
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error checking existing plugin: {e}")
            return {'exists': False, 'error': str(e)}
    
    async def _create_database_records(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Create plugin and module records in database"""
        try:
            current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            plugin_slug = self.plugin_data['plugin_slug']
            plugin_id = f"{user_id}_{plugin_slug}"
            
            logger.info(f"BrainDriveWhyDetector: Creating database records for {plugin_id}")
            
            plugin_stmt = text("""
            INSERT INTO plugin
            (id, name, description, version, type, enabled, icon, category, status,
            official, author, last_updated, compatibility, downloads, scope,
            bundle_method, bundle_location, is_local, long_description,
            config_fields, messages, dependencies, created_at, updated_at, user_id,
            plugin_slug, source_type, source_url, update_check_url, last_update_check,
            update_available, latest_version, installation_type, permissions)
            VALUES
            (:id, :name, :description, :version, :type, :enabled, :icon, :category,
            :status, :official, :author, :last_updated, :compatibility, :downloads,
            :scope, :bundle_method, :bundle_location, :is_local, :long_description,
            :config_fields, :messages, :dependencies, :created_at, :updated_at, :user_id,
            :plugin_slug, :source_type, :source_url, :update_check_url, :last_update_check,
            :update_available, :latest_version, :installation_type, :permissions)
            """)
            
            await db.execute(plugin_stmt, {
                'id': plugin_id,
                'name': self.plugin_data['name'],
                'description': self.plugin_data['description'],
                'version': self.plugin_data['version'],
                'type': self.plugin_data['type'],
                'enabled': True,
                'icon': self.plugin_data['icon'],
                'category': self.plugin_data['category'],
                'status': 'activated',
                'official': self.plugin_data['official'],
                'author': self.plugin_data['author'],
                'last_updated': current_time,
                'compatibility': self.plugin_data['compatibility'],
                'downloads': 0,
                'scope': self.plugin_data['scope'],
                'bundle_method': self.plugin_data['bundle_method'],
                'bundle_location': self.plugin_data['bundle_location'],
                'is_local': self.plugin_data['is_local'],
                'long_description': self.plugin_data['long_description'],
                'config_fields': json.dumps({}),
                'messages': None,
                'dependencies': None,
                'created_at': current_time,
                'updated_at': current_time,
                'user_id': user_id,
                'plugin_slug': plugin_slug,
                'source_type': self.plugin_data['source_type'],
                'source_url': self.plugin_data['source_url'],
                'update_check_url': self.plugin_data['update_check_url'],
                'last_update_check': self.plugin_data['last_update_check'],
                'update_available': self.plugin_data['update_available'],
                'latest_version': self.plugin_data['latest_version'],
                'installation_type': self.plugin_data['installation_type'],
                'permissions': json.dumps(self.plugin_data['permissions'])
            })
            
            # Create modules
            modules_created = []
            for module_data in self.module_data:
                module_id = f"{user_id}_{plugin_slug}_{module_data['name']}"
                
                module_stmt = text("""
                INSERT INTO module
                (id, plugin_id, name, display_name, description, icon, category,
                enabled, priority, props, config_fields, messages, required_services,
                dependencies, layout, tags, created_at, updated_at, user_id)
                VALUES
                (:id, :plugin_id, :name, :display_name, :description, :icon, :category,
                :enabled, :priority, :props, :config_fields, :messages, :required_services,
                :dependencies, :layout, :tags, :created_at, :updated_at, :user_id)
                """)
                
                await db.execute(module_stmt, {
                    'id': module_id,
                    'plugin_id': plugin_id,
                    'name': module_data['name'],
                    'display_name': module_data['display_name'],
                    'description': module_data['description'],
                    'icon': module_data['icon'],
                    'category': module_data['category'],
                    'enabled': True,
                    'priority': module_data['priority'],
                    'props': json.dumps(module_data['props']),
                    'config_fields': json.dumps(module_data['config_fields']),
                    'messages': json.dumps(module_data['messages']),
                    'required_services': json.dumps(module_data['required_services']),
                    'dependencies': json.dumps(module_data['dependencies']),
                    'layout': json.dumps(module_data['layout']),
                    'tags': json.dumps(module_data['tags']),
                    'created_at': current_time,
                    'updated_at': current_time,
                    'user_id': user_id
                })
                
                modules_created.append(module_id)
            
            await db.commit()
            
            # Verify
            verify_query = text("SELECT id FROM plugin WHERE id = :plugin_id AND user_id = :user_id")
            verify_result = await db.execute(verify_query, {'plugin_id': plugin_id, 'user_id': user_id})
            verify_row = verify_result.fetchone()
            
            if verify_row:
                logger.info(f"BrainDriveWhyDetector: Created records for {plugin_id}")
            else:
                return {'success': False, 'error': 'Plugin creation verification failed'}
            
            return {'success': True, 'plugin_id': plugin_id, 'modules_created': modules_created}
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error creating database records: {e}")
            await db.rollback()
            return {'success': False, 'error': str(e)}
    
    async def _delete_database_records(self, user_id: str, plugin_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Delete plugin and module records from database"""
        try:
            # Delete modules first
            module_delete_stmt = text("""
            DELETE FROM module 
            WHERE plugin_id = :plugin_id AND user_id = :user_id
            """)
            
            module_result = await db.execute(module_delete_stmt, {
                'plugin_id': plugin_id,
                'user_id': user_id
            })
            
            deleted_modules = module_result.rowcount
            
            # Delete plugin
            plugin_delete_stmt = text("""
            DELETE FROM plugin 
            WHERE id = :plugin_id AND user_id = :user_id
            """)
            
            plugin_result = await db.execute(plugin_delete_stmt, {
                'plugin_id': plugin_id,
                'user_id': user_id
            })
            
            if plugin_result.rowcount == 0:
                await db.rollback()
                return {'success': False, 'error': 'Plugin not found'}
            
            await db.commit()
            
            logger.info(f"BrainDriveWhyDetector: Deleted records for {plugin_id}")
            return {'success': True, 'deleted_modules': deleted_modules}
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error deleting records: {e}")
            await db.rollback()
            return {'success': False, 'error': str(e)}
    
    async def _create_plugin_page(self, user_id: str, db: AsyncSession, modules_created: List[str]) -> Dict[str, Any]:
        """Create a page for the WhyDetector plugin"""
        try:
            # Check if page already exists
            check_stmt = text("""
                SELECT id FROM pages
                WHERE creator_id = :user_id AND route = :route
            """)
            existing_result = await db.execute(check_stmt, {
                "user_id": user_id,
                "route": "why-finder-v1"
            })
            existing = existing_result.fetchone()
            
            if existing:
                existing_page_id = existing.id if hasattr(existing, "id") else existing[0]
                logger.info(f"BrainDriveWhyDetector: Page already exists for {user_id}", page_id=existing_page_id)
                return {"success": True, "page_id": existing_page_id, "created": False}
            
            # Find the module ID
            module_id = None
            for mid in modules_created:
                if mid.endswith("_BrainDriveWhyDetector"):
                    module_id = mid
                    break
            
            if not module_id:
                # Fallback query
                module_stmt = text("""
                    SELECT id FROM module
                    WHERE user_id = :user_id AND plugin_id = :plugin_id AND name = :name
                """)
                plugin_id = f"{user_id}_{self.plugin_data['plugin_slug']}"
                module_result = await db.execute(module_stmt, {
                    "user_id": user_id,
                    "plugin_id": plugin_id,
                    "name": "BrainDriveWhyDetector"
                })
                module_row = module_result.fetchone()
                if module_row:
                    module_id = module_row.id if hasattr(module_row, "id") else module_row[0]
            
            if not module_id:
                logger.error(f"BrainDriveWhyDetector: Failed to resolve module ID for {user_id}")
                return {"success": False, "error": "Unable to resolve WhyDetector module ID"}
            
            # Create page content with layouts
            timestamp_ms = int(datetime.datetime.utcnow().timestamp() * 1000)
            layout_id = f"WhyDetector_{module_id}_{timestamp_ms}"
            
            content = {
                "layouts": {
                    "desktop": [
                        {
                            "i": layout_id,
                            "x": 0,
                            "y": 0,
                            "w": 12,
                            "h": 10,
                            "pluginId": self.plugin_data["plugin_slug"],
                            "args": {
                                "moduleId": "BrainDriveWhyDetector",
                                "displayName": "Why Discovery Coach"
                            }
                        }
                    ],
                    "tablet": [
                        {
                            "i": layout_id,
                            "x": 0,
                            "y": 0,
                            "w": 4,
                            "h": 6,
                            "pluginId": self.plugin_data["plugin_slug"],
                            "args": {
                                "moduleId": "BrainDriveWhyDetector",
                                "displayName": "Why Discovery Coach"
                            }
                        }
                    ],
                    "mobile": [
                        {
                            "i": layout_id,
                            "x": 0,
                            "y": 0,
                            "w": 4,
                            "h": 6,
                            "pluginId": self.plugin_data["plugin_slug"],
                            "args": {
                                "moduleId": "BrainDriveWhyDetector",
                                "displayName": "Why Discovery Coach"
                            }
                        }
                    ]
                },
                "modules": {}
            }
            
            # Insert page
            page_id = uuid.uuid4().hex
            now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            
            insert_stmt = text("""
                INSERT INTO pages (
                    id, name, route, content, creator_id,
                    created_at, updated_at, is_published, publish_date
                ) VALUES (
                    :id, :name, :route, :content, :creator_id,
                    :created_at, :updated_at, :is_published, :publish_date
                )
            """)
            
            await db.execute(insert_stmt, {
                "id": page_id,
                "name": "Why Finder v1",
                "route": "why-finder-v1",
                "content": json.dumps(content),
                "creator_id": user_id,
                "created_at": now,
                "updated_at": now,
                "is_published": 1,
                "publish_date": now
            })
            
            await db.commit()
            logger.info(f"BrainDriveWhyDetector: Created page for {user_id}", page_id=page_id)
            return {"success": True, "page_id": page_id, "created": True}
            
        except Exception as e:
            await db.rollback()
            logger.error(f"BrainDriveWhyDetector: Failed to create page for {user_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _delete_plugin_page(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Delete the WhyDetector plugin page"""
        try:
            delete_stmt = text("""
                DELETE FROM pages
                WHERE creator_id = :user_id AND route = :route
            """)
            result = await db.execute(delete_stmt, {
                "user_id": user_id,
                "route": "why-finder-v1"
            })
            await db.commit()
            logger.info(f"BrainDriveWhyDetector: Deleted page for {user_id}", deleted_rows=result.rowcount)
            return {"success": True, "deleted_rows": result.rowcount}
            
        except Exception as e:
            await db.rollback()
            logger.error(f"BrainDriveWhyDetector: Failed to delete page for {user_id}: {e}")
            return {"success": False, "error": str(e)}
    
    def get_plugin_info(self) -> Dict[str, Any]:
        """Get plugin information"""
        return self.plugin_data
    
    @property
    def MODULE_DATA(self):
        """Compatibility property for module data"""
        return self.module_data
    
    # Compatibility methods
    async def install_plugin(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Install plugin for user"""
        try:
            logger.info(f"BrainDriveWhyDetector: Starting installation for {user_id}")
            
            existing_check = await self._check_existing_plugin(user_id, db)
            if existing_check['exists']:
                logger.warning(f"BrainDriveWhyDetector: Already installed for {user_id}")
                return {
                    'success': False,
                    'error': 'Plugin already installed',
                    'plugin_id': existing_check['plugin_id']
                }
            
            shared_path = self.shared_path
            shared_path.mkdir(parents=True, exist_ok=True)

            copy_result = await self._copy_plugin_files_impl(user_id, shared_path)
            if not copy_result['success']:
                return copy_result
            
            result = await self.install_for_user(user_id, db, shared_path)
            
            if result.get('success'):
                verify_check = await self._check_existing_plugin(user_id, db)
                if not verify_check['exists']:
                    return {'success': False, 'error': 'Installation verification failed'}
                
                result.update({
                    'plugin_slug': self.plugin_data['plugin_slug'],
                    'plugin_name': self.plugin_data['name']
                })
            
            return result
                
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Install failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def delete_plugin(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Delete plugin for user"""
        try:
            logger.info(f"BrainDriveWhyDetector: Starting deletion for {user_id}")
            # Call _perform_user_uninstallation directly (don't use base class uninstall_for_user 
            # which checks active_users runtime set)
            result = await self._perform_user_uninstallation(user_id, db)
            return result
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Delete failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_plugin_status(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Get plugin status"""
        try:
            existing_check = await self._check_existing_plugin(user_id, db)
            if not existing_check['exists']:
                return {'exists': False, 'status': 'not_installed'}
            
            plugin_health = await self._get_plugin_health_impl(user_id, self.shared_path)
            
            return {
                'exists': True,
                'status': 'healthy' if plugin_health['healthy'] else 'unhealthy',
                'plugin_id': existing_check['plugin_id'],
                'plugin_info': existing_check['plugin_info'],
                'health_details': plugin_health['details']
            }
            
        except Exception as e:
            logger.error(f"BrainDriveWhyDetector: Error checking status: {e}")
            return {'exists': False, 'status': 'error', 'error': str(e)}


# Standalone functions for compatibility with BrainDrive installer
async def install_plugin(user_id: str, db: AsyncSession, plugins_base_dir: str = None) -> Dict[str, Any]:
    manager = BrainDriveWhyDetectorLifecycleManager(plugins_base_dir)
    return await manager.install_plugin(user_id, db)

async def delete_plugin(user_id: str, db: AsyncSession, plugins_base_dir: str = None) -> Dict[str, Any]:
    manager = BrainDriveWhyDetectorLifecycleManager(plugins_base_dir)
    return await manager.delete_plugin(user_id, db)

async def get_plugin_status(user_id: str, db: AsyncSession, plugins_base_dir: str = None) -> Dict[str, Any]:
    manager = BrainDriveWhyDetectorLifecycleManager(plugins_base_dir)
    return await manager.get_plugin_status(user_id, db)


# Test script
if __name__ == "__main__":
    import asyncio
    
    async def main():
        print("BrainDriveWhyDetector Plugin Lifecycle Manager - Test Mode")
        print("=" * 60)
        
        manager = BrainDriveWhyDetectorLifecycleManager()
        print(f"Plugin: {manager.plugin_data['name']}")
        print(f"Version: {manager.plugin_data['version']}")
        print(f"Slug: {manager.plugin_data['plugin_slug']}")
        print(f"Description: {manager.plugin_data['description']}")
        print(f"Modules: {len(manager.module_data)}")
        
        for module in manager.module_data:
            print(f"  - {module['display_name']} ({module['name']})")
    
    asyncio.run(main())


