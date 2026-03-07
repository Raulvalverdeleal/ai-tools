#!/usr/bin/env node
// --- Configuration & Initialization ---
const config = require('./config');

const { SENTRY_TOKEN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_BASE_URL } = config;
if (!SENTRY_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT || !SENTRY_BASE_URL) {
    console.error(JSON.stringify({ 
        error: 'Missing required Sentry configuration in config/index.js',
        required: ['SENTRY_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_BASE_URL']
    }));
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${SENTRY_TOKEN}`,
    'Content-Type': 'application/json'
};

// --- API Methods ---

/**
 * Lists unresolved issues with pagination support
 */
async function listIssues(limit = 20, cursor = '') {
    let url = `${SENTRY_BASE_URL}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&sort=freq&limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        
        const data = await res.json();
        
        // Extract pagination info from Link header if present
        const linkHeader = res.headers.get('Link');
        const pagination = parseLinkHeader(linkHeader);

        console.log(JSON.stringify({
            issues: data.map(issue => ({
                id: issue.id,
                shortId: issue.shortId,
                title: issue.title,
                culprit: issue.culprit,
                count: issue.count,
                userCount: issue.userCount,
                firstSeen: issue.firstSeen,
                lastSeen: issue.lastSeen,
                permalink: issue.permalink,
                priority: issue.priority,
                assignedTo: issue.assignedTo
            })),
            pagination
        }, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ error: e.message }));
    }
}

/**
 * Fetches detailed info for an issue, including latest event and breadcrumbs
 */
async function getIssueDetails(issueId) {
    const url = `${SENTRY_BASE_URL}/issues/${issueId}/`;
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();

        // Fetch latest event for stack trace and breadcrumbs
        const eventRes = await fetch(`${SENTRY_BASE_URL}/issues/${issueId}/events/latest/`, { headers });
        if (eventRes.ok) {
            const eventData = await eventRes.json();
            
            // Extract relevant diagnostic info
            data.diagnostics = {
                message: eventData.message || eventData.title,
                timestamp: eventData.dateCreated,
                release: eventData.release ? eventData.release.version : 'unknown',
                environment: eventData.tags.find(t => t.key === 'environment')?.value || 'unknown',
                user: eventData.user,
                tags: eventData.tags.reduce((acc, t) => ({ ...acc, [t.key]: t.value }), {}),
                breadcrumbs: eventData.entries.find(e => e.type === 'breadcrumbs')?.data?.values || [],
                exception: eventData.entries.find(e => e.type === 'exception')?.data?.values || []
            };
        }

        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ error: e.message }));
    }
}

/**
 * Resolves an issue
 */
async function resolveIssue(issueId) {
    const url = `${SENTRY_BASE_URL}/issues/${issueId}/`;
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'resolved' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        console.log(JSON.stringify({ success: true, id: data.id, status: data.status }, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ error: e.message }));
    }
}

/**
 * Ignores (archives) an issue permanently — it will no longer appear in unresolved
 */
async function ignoreIssue(issueId) {
    const url = `${SENTRY_BASE_URL}/issues/${issueId}/`;
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'ignored' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        console.log(JSON.stringify({ success: true, id: data.id, status: data.status, note: 'Issue archived/ignored permanently' }, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ error: e.message }));
    }
}

/**
 * Lists available projects (Discovery tool)
 */
async function discover() {
    try {
        const res = await fetch(`${SENTRY_BASE_URL}/projects/`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const projects = await res.json();
        const simplified = projects.map(p => ({
            name: p.name,
            slug: p.slug,
            org_slug: p.organization.slug,
            platform: p.platform
        }));
        console.log(JSON.stringify(simplified, null, 2));
    } catch (e) {
        console.error(JSON.stringify({ error: e.message }));
    }
}

// --- Helpers ---

function parseLinkHeader(header) {
    if (!header) return {};
    const links = {};
    const parts = header.split(',');
    parts.forEach(part => {
        const section = part.split(';');
        if (section.length < 2) return;
        const url = section[0].replace(/<(.*)>/, '$1').trim();
        const name = section[1].trim();
        const results = section[2]?.trim() === 'results="true"';
        const cursor = new URL(url).searchParams.get('cursor');
        
        if (name.includes('rel="next"')) links.next = { cursor, results };
        if (name.includes('rel="prev"')) links.prev = { cursor, results };
    });
    return links;
}

// --- CLI Runner ---

const args = process.argv.slice(2);
const command = args[0];

(async () => {
    switch (command) {
        case 'discover':
            await discover();
            break;
        case 'list_issues':
            await listIssues(args[1] || 20, args[2] || '');
            break;
        case 'get_issue_details':
            if (!args[1]) {
                process.stdout.write(JSON.stringify({ error: 'Missing issue_id' }));
                process.exit(1);
            }
            await getIssueDetails(args[1]);
            break;
        case 'resolve_issue':
            if (!args[1]) {
                process.stdout.write(JSON.stringify({ error: 'Missing issue_id' }));
                process.exit(1);
            }
            await resolveIssue(args[1]);
            break;
        case 'ignore_issue':
            if (!args[1]) {
                process.stdout.write(JSON.stringify({ error: 'Missing issue_id' }));
                process.exit(1);
            }
            await ignoreIssue(args[1]);
            break;
        default:
            console.error('Usage: node sentry-api.js [command] [args]');
            console.error('Commands: discover, list_issues [limit] [cursor], get_issue_details <id>, resolve_issue <id>, ignore_issue <id>');
            process.exit(1);
    }
})();
