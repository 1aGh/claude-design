{
  "$schema": "https://raw.githubusercontent.com/1aGh/md-claude/main/plugins/design/dev-server/config.schema.json",
  "name": "{{project_name}}",
  "projectLabel": "{{project_label}}",
  "designRoot": ".design",
  "canvasGroups": [
    { "label": "Design system", "path": "system" },
    { "label": "UI kit", "path": "ui" }
  ],
  "rootClass": "{{root_class}}",
  "themeDefault": "{{theme_default}}",
  "tokensCssRel": "system/{{ds_dirname}}/colors_and_type.css",
  "teamAccentDefault": null,
  "handoffTargets": {{handoff_targets}},
  "newCanvasDir": "ui/{{ds_dirname}}",
  "newComponentDir": "ui/{{ds_dirname}}/components",
  "extensions": [],
  "completenessProfile": "standard",
  "activeFamilies": {{active_families}},
  "designSystems": [
    {
      "name": "{{ds_dirname}}",
      "path": "system/{{ds_dirname}}",
      "description": "{{ds_description}}"
    }
  ],
  "defaultDesignSystem": "{{ds_dirname}}"
}
