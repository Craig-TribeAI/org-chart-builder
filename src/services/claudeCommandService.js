/**
 * Claude API integration for interpreting natural language commands
 */

import { buildOrgChartContext, buildUserPrompt } from '../utils/orgChartContext';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Build the system prompt that instructs Claude how to interpret commands
 * @returns {string} System prompt
 */
function buildSystemPrompt() {
  return `You are an org chart command interpreter. Your job is to parse natural language commands and convert them to structured actions.

Available actions:

1. ADD_ROLE - Create a new custom role
   Params: { roleName: string, departmentId: string, managerId: string }
   Use when: User wants to create/add a new position or role

2. ADD_MULTIPLE_ROLES - Create multiple custom roles at once
   Params: { roles: Array<{ roleName: string, departmentId: string, managerId: string }> }
   Use when: User wants to add multiple roles, like "add a manager with two direct reports"

3. DELETE_ROLE - Delete a custom role (only works for isCustom=true roles)
   Params: { personIds: string[] }
   Use when: User wants to remove/delete/fire someone (note: can only delete custom-created roles)

4. SET_MANAGER - Assign a manager to one person
   Params: { personId: string, managerId: string }
   Use when: User wants to assign someone to report to another person

5. BULK_SET_MANAGER - Assign the same manager to multiple people
   Params: { personIds: string[], managerId: string }
   Use when: User wants to assign multiple people to the same manager

6. REMOVE_MANAGER - Remove manager assignment from one person
   Params: { personId: string }
   Use when: User wants to unassign someone from their manager

7. BULK_REMOVE_MANAGER - Remove manager from multiple people
   Params: { personIds: string[] }
   Use when: User wants to unassign multiple people from their managers

Response format (JSON only, no markdown code blocks):
{
  "success": true,
  "command": {
    "type": "ACTION_TYPE",
    "description": "Human readable description of what will happen",
    "isDestructive": true/false,
    "params": { ... },
    "affectedCount": number
  }
}

For ambiguous or invalid commands:
{
  "success": false,
  "error": "Explanation of what was unclear or why the command cannot be executed",
  "suggestions": ["Possible interpretation 1", "Possible interpretation 2"]
}

CRITICAL - Manager Inference Rules:
When adding new roles, you MUST always include a managerId. Infer the appropriate manager using these rules in order:

1. EXPLICIT MENTION: If user mentions a specific person (e.g., "add 2 engineers to Sarah's team", "reporting to Mike"), use that person as manager
2. ROLE-BASED: Look at "Manager hierarchy" - find who currently manages similar roles. Example: if adding "AI Engineer" roles, find who already manages AI Engineers
3. DEPARTMENT-BASED: Look at "Department managers" - use the top manager for that department who manages the most people
4. TEAM EXPANSION: If user says "add more X" or "expand the X team", find who manages existing X roles

ALWAYS include the inferred manager in your description, e.g., "Add 3 AI Engineers to Product + Eng - Foundry, reporting to Sarah Chen"

General Rules:
- Match person names fuzzy (e.g., "Sarah" matches "Sarah Chen", "Sarah 1", etc.)
- Match role names fuzzy and case-insensitive (e.g., "AI Engineer" matches "AI engineer", "ai engineers")
- For bulk operations, find all matching people and include their exact IDs
- When user says "all X", find all matching people
- Department names should match existing departments (fuzzy match okay)
- If a number is specified (e.g., "20 AI engineers"), limit to that count
- For "add X with Y direct reports", create the manager role first, then create Y roles reporting to it
- Destructive actions: DELETE_ROLE, REMOVE_MANAGER, BULK_REMOVE_MANAGER
- For roles that are NOT custom (isCustom=false), you cannot delete them - explain this in error
- Always include ALL matching person IDs in the params
- Return ONLY valid JSON, no explanation text before or after`;
}

/**
 * Parse Claude's response text into a command object
 * @param {string} responseText - Claude's response
 * @returns {Object} Parsed command object
 */
function parseCommandResponse(responseText) {
  try {
    // Try to extract JSON from the response
    const text = responseText.trim();

    // Handle case where response might be wrapped in markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1].trim() : text;

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse Claude response:', responseText);
    return {
      success: false,
      error: 'Failed to parse command response',
      rawResponse: responseText
    };
  }
}

/**
 * Interpret a natural language command using Claude API
 * @param {string} command - The user's text command
 * @param {Object} store - The org chart store state
 * @returns {Promise<Object>} Parsed command object
 */
export async function interpretCommand(command, store) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env.local file.'
    };
  }

  const context = buildOrgChartContext(store);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(command, context);

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.content[0]?.text || '';

    return parseCommandResponse(responseText);
  } catch (error) {
    console.error('Claude API error:', error);
    return {
      success: false,
      error: `Failed to interpret command: ${error.message}`
    };
  }
}

/**
 * Check if a command type is destructive
 * @param {string} commandType - The command type
 * @returns {boolean} Whether the command is destructive
 */
export function isDestructiveCommand(commandType) {
  return [
    'DELETE_ROLE',
    'REMOVE_MANAGER',
    'BULK_REMOVE_MANAGER'
  ].includes(commandType);
}
