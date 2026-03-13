import type { ChatCompletionTool } from 'openai/resources/chat'

/**
 * All tool names as a union — used to type the dispatcher in tool-handlers.ts.
 * Adding a new tool requires: (1) adding it here, (2) adding its schema to TOOLS,
 * (3) adding a handler in tool-handlers.ts.
 */
export type ToolName =
  | 'get_batches'
  | 'get_learners'
  | 'get_learner_detail'
  | 'get_learner_applications'
  | 'get_pipeline_summary'
  | 'get_applications'
  | 'get_companies'
  | 'get_roles'
  | 'get_hired_learners'
  | 'get_tat_metrics'
  | 'get_job_personas'
  | 'get_job_opportunities'

/**
 * The tool schemas the LLM sees. These are deliberately narrow:
 * - No free-form filters, arbitrary column selection, or SQL fragments.
 * - All enum values mirror the actual DB values so the LLM can't hallucinate statuses.
 * - Every description is written for the LLM, not the developer — it explains *when*
 *   to call the tool, not just what it does.
 */
export const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_batches' satisfies ToolName,
      description:
        'Returns all distinct batch names that exist in the system. ' +
        'Call this first when the user mentions a batch name you are not certain about ' +
        '(e.g. "batch 10" — you need the exact string like "Batch 10").',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_learners' satisfies ToolName,
      description:
        'Lists learners with optional filters. Returns name, email, batch, track, ' +
        'readiness, and LF name. Use this to answer questions like "who are the ' +
        'ready learners in Batch 10?" or "show me blacklisted learners".',
      parameters: {
        type: 'object',
        properties: {
          batch_name: {
            type: 'string',
            description: 'Exact batch name (e.g. "Batch 10"). Use get_batches first if unsure.',
          },
          lf_name: {
            type: 'string',
            description: 'Filter by LF (Learning Facilitator) name — partial match.',
          },
          readiness: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['ready', 'almost_ready', 'not_ready'],
            },
            description: 'Filter by one or more readiness values.',
          },
          blacklisted: {
            type: 'boolean',
            description:
              'true = return only blacklisted learners, false = only non-blacklisted.',
          },
          limit: {
            type: 'number',
            description: 'Max learners to return. Defaults to 50, max 200.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_learner_detail' satisfies ToolName,
      description:
        'Returns the full profile for a single learner: scores (tech_score, proactiveness, ' +
        'articulation, comprehension), batch, track, LF, readiness, PRS, and graduation info. ' +
        'Provide either learner_id (e.g. "HVA001") or email — not both.',
      parameters: {
        type: 'object',
        properties: {
          learner_id: { type: 'string', description: 'Domain key like "HVA001".' },
          email: { type: 'string', description: "Learner's email address." },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_learner_applications' satisfies ToolName,
      description:
        'Returns all job applications for a specific learner, with company, role title, ' +
        'status, and relevant feedback. Use this to answer "what companies has [learner] ' +
        'applied to?" or "what feedback did [learner] receive?".',
      parameters: {
        type: 'object',
        properties: {
          learner_id: { type: 'string', description: 'Domain key like "HVA001".' },
          email: { type: 'string', description: "Learner's email address." },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_pipeline_summary' satisfies ToolName,
      description:
        'Returns aggregate application counts broken down by status. This is the primary ' +
        'tool for funnel/pipeline questions like "how many learners are hired?", ' +
        '"what is the shortlisting rate?", or "show me the placement funnel for Batch 10".',
      parameters: {
        type: 'object',
        properties: {
          batch_name: {
            type: 'string',
            description: 'Scope counts to a specific batch.',
          },
          company_name: {
            type: 'string',
            description: 'Scope counts to a specific company.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_applications' satisfies ToolName,
      description:
        'Returns a filtered list of individual applications with learner name, company, ' +
        'role, and status. Use when you need the actual rows (not counts). ' +
        'For counts, prefer get_pipeline_summary.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'applied',
                'shortlisted',
                'interviews_ongoing',
                'on_hold',
                'hired',
                'not_shortlisted',
                'rejected',
              ],
            },
            description: 'Filter by one or more application statuses.',
          },
          company_name: {
            type: 'string',
            description: 'Filter by company name.',
          },
          batch_name: {
            type: 'string',
            description: 'Filter by learner batch name.',
          },
          limit: {
            type: 'number',
            description: 'Max results to return. Defaults to 50, max 200.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_companies' satisfies ToolName,
      description:
        'Lists all hiring companies with their total role count and open role count. ' +
        'Use for "which companies are we working with?" or "how many open roles does each company have?".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_roles' satisfies ToolName,
      description:
        'Lists job roles, optionally filtered by company or open/closed status. ' +
        'Use for "what roles does Accenture have?" or "show me all open roles".',
      parameters: {
        type: 'object',
        properties: {
          company_name: {
            type: 'string',
            description: 'Filter to roles at a specific company.',
          },
          status: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Filter by role status. Defaults to "all".',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_hired_learners' satisfies ToolName,
      description:
        'Returns learners who have been hired, along with the company and role they were hired into. ' +
        'More focused than get_applications for "who got placed?" questions.',
      parameters: {
        type: 'object',
        properties: {
          batch_name: {
            type: 'string',
            description: 'Filter by batch name.',
          },
          company_name: {
            type: 'string',
            description: 'Filter by company name.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_tat_metrics' satisfies ToolName,
      description:
        'Returns average turnaround time (TAT) in days for key placement milestones: ' +
        'time to shortlisting decision, time from shortlist to interview start, and ' +
        'time from interview to hiring decision. Use for "how fast are companies responding?" questions.',
      parameters: {
        type: 'object',
        properties: {
          batch_name: {
            type: 'string',
            description: 'Scope to a specific batch.',
          },
          company_name: {
            type: 'string',
            description: 'Scope to a specific company.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_job_personas' satisfies ToolName,
      description:
        'Lists job outreach personas — profiles that define what kinds of jobs to scrape ' +
        '(e.g. "Junior Data Analyst"). Use for "what personas do we have?" questions.',
      parameters: {
        type: 'object',
        properties: {
          active_only: {
            type: 'boolean',
            description: 'If true, return only active personas.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_job_opportunities' satisfies ToolName,
      description:
        'Lists scraped job opportunities from the outreach engine, optionally filtered ' +
        'by persona or review status. Use for "what jobs have we found?" or "what approved ' +
        'opportunities do we have for [persona]?".',
      parameters: {
        type: 'object',
        properties: {
          persona_name: {
            type: 'string',
            description: 'Filter by persona name (partial match).',
          },
          status: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['discovered', 'reviewed', 'approved', 'rejected'],
            },
            description: 'Filter by one or more opportunity statuses.',
          },
          limit: {
            type: 'number',
            description: 'Max results to return. Defaults to 20, max 100.',
          },
        },
        required: [],
      },
    },
  },
]
