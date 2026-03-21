# `tasks.json` Schema

Canonical contract for `.pipeline/tasks/tasks.json`.

```json
{
  "master": {
    "tasks": [
      {
        "id": 1,
        "title": "<string>",
        "description": "<string>",
        "status": "pending",
        "stage": "survey|ideation|experiment|publication|promotion",
        "priority": "high|medium|low",
        "dependencies": [],
        "taskType": "exploration|implementation|analysis|writing|scripting|rendering|narration|delivery",
        "inputsNeeded": ["sections.ideation.research_goal"],
        "suggestedSkills": ["inno-idea-generation"],
        "sourceBlueprintId": "<string>",
        "nextActionPrompt": "<string>",
        "createdAt": "<ISO timestamp>",
        "updatedAt": "<ISO timestamp>"
      }
    ]
  }
}
```
