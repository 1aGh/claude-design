---
"@1agh/maude": patch
---

Fixes the Windows desktop build, which still failed after the previous fix (`resource path 'resources\plugins\kgai' doesn't exist`). Both kgai resource directories are mapped unconditionally, so both have to exist even on a platform kgai publishes no engine for — only one of them was being created. The empty plugin directory is inert; the app simply finds no kgai plugin and the knowledge graph stays inactive, which is the documented degradation.
