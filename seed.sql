-- AgentJobs Seed Data
-- Passwords are all "password123" hashed with bcrypt

-- ============================================
-- USERS
-- ============================================

-- Job Seekers
INSERT INTO users (id, email, password_hash, role) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'alice@example.com', '$2b$10$Wnu/1wLIGkOSXtz.mgA1XO7O78pqUFIseD9rlw9zGZFmPP0zl3BVK', 'job_seeker'),
  ('a1000000-0000-0000-0000-000000000002', 'bob@example.com', '$2b$10$Wnu/1wLIGkOSXtz.mgA1XO7O78pqUFIseD9rlw9zGZFmPP0zl3BVK', 'job_seeker'),
  ('a1000000-0000-0000-0000-000000000003', 'carol@example.com', '$2b$10$Wnu/1wLIGkOSXtz.mgA1XO7O78pqUFIseD9rlw9zGZFmPP0zl3BVK', 'job_seeker');

-- Employers
INSERT INTO users (id, email, password_hash, role) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'hr@acmecorp.com', '$2b$10$Wnu/1wLIGkOSXtz.mgA1XO7O78pqUFIseD9rlw9zGZFmPP0zl3BVK', 'employer'),
  ('b2000000-0000-0000-0000-000000000002', 'jobs@startupio.com', '$2b$10$Wnu/1wLIGkOSXtz.mgA1XO7O78pqUFIseD9rlw9zGZFmPP0zl3BVK', 'employer');

-- ============================================
-- JOB SEEKERS (profiles)
-- ============================================

INSERT INTO job_seekers (id, user_id, full_name, resume_text, skills, preferred_job_titles, preferred_locations, min_salary, max_salary, experience_years, remote_preference, agent_active, has_paid) VALUES
(
  'c3000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'Alice Johnson',
  'Senior Full Stack Engineer with 6 years of experience building scalable web applications. Led migration from monolith to microservices at previous company serving 2M users. Strong background in React, Node.js, and PostgreSQL. Passionate about clean code and developer experience. Previously at Stripe and Shopify.',
  ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL'],
  ARRAY['Senior Software Engineer', 'Full Stack Developer', 'Staff Engineer'],
  ARRAY['San Francisco', 'Remote'],
  140000, 200000, 6, 'remote', true, true
),
(
  'c3000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  'Bob Martinez',
  'Frontend engineer specializing in React and design systems. 3 years of experience building consumer-facing products. Created a component library used by 50+ developers. Strong eye for UI/UX with background in graphic design. Experience with accessibility and performance optimization.',
  ARRAY['React', 'TypeScript', 'CSS', 'Figma', 'Next.js', 'Tailwind'],
  ARRAY['Frontend Engineer', 'UI Engineer', 'Software Engineer'],
  ARRAY['New York', 'Remote'],
  100000, 140000, 3, 'hybrid', true, true
),
(
  'c3000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000003',
  'Carol Chen',
  'Backend engineer with deep expertise in Python and data infrastructure. 8 years building ETL pipelines, APIs, and ML model serving systems. Led data platform team at a Series C startup. Strong knowledge of distributed systems, Kafka, and Kubernetes.',
  ARRAY['Python', 'Go', 'Kafka', 'Kubernetes', 'PostgreSQL', 'Redis', 'Terraform'],
  ARRAY['Backend Engineer', 'Platform Engineer', 'Staff Engineer'],
  ARRAY['Seattle', 'San Francisco', 'Remote'],
  160000, 220000, 8, 'any', true, true
);

-- ============================================
-- EMPLOYERS (profiles)
-- ============================================

INSERT INTO employers (id, user_id, company_name, company_description, industry, company_size, website) VALUES
(
  'd4000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  'Acme Corp',
  'Enterprise SaaS platform for supply chain management. Series D, 500+ employees. We help Fortune 500 companies optimize their logistics.',
  'Enterprise SaaS',
  'large',
  'https://acmecorp.example.com'
),
(
  'd4000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000002',
  'Startup.io',
  'AI-powered developer tools. Seed stage, 12 people. Building the future of code review and automated testing.',
  'Developer Tools',
  'startup',
  'https://startupio.example.com'
);

-- ============================================
-- JOB POSTINGS
-- ============================================

INSERT INTO job_postings (id, employer_id, title, description, required_skills, nice_to_have_skills, skill_weights, min_match_score, location, remote_type, salary_min, salary_max, experience_min, experience_max, status) VALUES
(
  'e5000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000001',
  'Senior Full Stack Engineer',
  'Join our platform team to build the next generation of our supply chain management tools. You will work on high-traffic React applications backed by Node.js microservices. Ownership of features from design to deployment. Strong emphasis on reliability and performance.',
  ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
  ARRAY['AWS', 'Docker', 'GraphQL', 'Kubernetes'],
  '{"React": 2, "TypeScript": 2, "Node.js": 3, "PostgreSQL": 2, "AWS": 1, "Docker": 1, "GraphQL": 1, "Kubernetes": 1}'::jsonb,
  70,
  'San Francisco',
  'hybrid',
  150000, 190000, 4, 8,
  'active'
),
(
  'e5000000-0000-0000-0000-000000000002',
  'd4000000-0000-0000-0000-000000000001',
  'Backend Platform Engineer',
  'We are looking for a backend engineer to help scale our data infrastructure. You will design and build APIs, manage our Kafka pipelines, and improve system reliability. Must be comfortable with distributed systems and high-throughput data processing.',
  ARRAY['Python', 'PostgreSQL', 'Kafka', 'Kubernetes'],
  ARRAY['Go', 'Terraform', 'Redis', 'AWS'],
  '{"Python": 3, "PostgreSQL": 2, "Kafka": 3, "Kubernetes": 2, "Go": 1, "Terraform": 1, "Redis": 1, "AWS": 1}'::jsonb,
  80,
  'San Francisco',
  'remote',
  160000, 210000, 5, 10,
  'active'
),
(
  'e5000000-0000-0000-0000-000000000003',
  'd4000000-0000-0000-0000-000000000001',
  'Frontend Engineer',
  'Help us rebuild our dashboard experience. We need someone who cares deeply about UI/UX and can ship polished, accessible interfaces. You will work closely with our design team and own the component library.',
  ARRAY['React', 'TypeScript', 'CSS'],
  ARRAY['Next.js', 'Tailwind', 'Figma', 'Accessibility'],
  NULL,
  NULL,
  'New York',
  'hybrid',
  110000, 150000, 2, 5,
  'active'
),
(
  'e5000000-0000-0000-0000-000000000004',
  'd4000000-0000-0000-0000-000000000002',
  'Founding Engineer',
  'Be one of the first engineers at Startup.io. You will build our core product from scratch—an AI-powered code review tool. Full ownership, direct impact, equity. We need a generalist who can move fast across the stack.',
  ARRAY['TypeScript', 'React', 'Node.js'],
  ARRAY['Python', 'AI/ML', 'PostgreSQL', 'Docker'],
  '{"TypeScript": 2, "React": 2, "Node.js": 2, "Python": 1, "AI/ML": 2}'::jsonb,
  65,
  'Remote',
  'remote',
  130000, 170000, 3, null,
  'active'
),
(
  'e5000000-0000-0000-0000-000000000005',
  'd4000000-0000-0000-0000-000000000002',
  'AI/ML Engineer',
  'Build the machine learning infrastructure behind our automated code review system. Fine-tune LLMs, build evaluation pipelines, and ship ML features to production. Must be comfortable with Python and modern ML tooling.',
  ARRAY['Python', 'PyTorch', 'LLMs'],
  ARRAY['TypeScript', 'Kubernetes', 'AWS'],
  '{"Python": 3, "PyTorch": 3, "LLMs": 4}'::jsonb,
  75,
  'Remote',
  'remote',
  150000, 200000, 3, 8,
  'active'
);

-- ============================================
-- APPLICATIONS (pre-existing to see in dashboard)
-- ============================================

-- Alice applied to Senior Full Stack Engineer at Acme
INSERT INTO applications (id, job_seeker_id, job_posting_id, status, match_score, cover_message) VALUES
(
  'f6000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000001',
  'e5000000-0000-0000-0000-000000000001',
  'shortlisted',
  92.50,
  'I am writing on behalf of Alice Johnson to express strong interest in the Senior Full Stack Engineer position at Acme Corp. Alice brings 6 years of experience building scalable web applications with React, TypeScript, Node.js, and PostgreSQL—precisely the stack your team uses. At her previous role at Stripe, she led a monolith-to-microservices migration serving 2M users, demonstrating the reliability and performance focus your job description emphasizes. She is particularly excited about the ownership model and would welcome the opportunity to discuss how her experience aligns with your team''s needs.'
);

-- Alice applied to Founding Engineer at Startup.io
INSERT INTO applications (id, job_seeker_id, job_posting_id, status, match_score, cover_message) VALUES
(
  'f6000000-0000-0000-0000-000000000002',
  'c3000000-0000-0000-0000-000000000001',
  'e5000000-0000-0000-0000-000000000004',
  'reviewing',
  85.00,
  'Alice Johnson is an excellent fit for the Founding Engineer role at Startup.io. With 6 years as a full stack engineer working across React, TypeScript, and Node.js, she has the generalist profile you are looking for. Her experience at both Stripe and Shopify means she understands what it takes to build products from zero to scale. She is drawn to the founding team opportunity and the chance to shape an AI-powered developer tool from the ground up.'
);

-- Bob applied to Frontend Engineer at Acme
INSERT INTO applications (id, job_seeker_id, job_posting_id, status, match_score, cover_message) VALUES
(
  'f6000000-0000-0000-0000-000000000003',
  'c3000000-0000-0000-0000-000000000002',
  'e5000000-0000-0000-0000-000000000003',
  'pending',
  88.75,
  'I am reaching out on behalf of Bob Martinez regarding the Frontend Engineer position at Acme Corp. Bob is a frontend specialist with 3 years of experience in React, TypeScript, and CSS—the core skills listed in your requirements. He has built and maintained a component library used by 50+ developers, which directly relates to your need for someone to own the component library. His background in graphic design gives him a strong eye for UI/UX, and he has hands-on experience with accessibility and Tailwind, both listed as nice-to-have skills.'
);

-- Carol applied to Backend Platform Engineer at Acme
INSERT INTO applications (id, job_seeker_id, job_posting_id, status, match_score, cover_message) VALUES
(
  'f6000000-0000-0000-0000-000000000004',
  'c3000000-0000-0000-0000-000000000003',
  'e5000000-0000-0000-0000-000000000002',
  'interview_scheduled',
  95.00,
  'Carol Chen is an outstanding match for the Backend Platform Engineer role at Acme Corp. With 8 years of backend engineering experience, she has deep expertise in Python, PostgreSQL, Kafka, and Kubernetes—all four of your required skills. She led the data platform team at a Series C startup where she designed ETL pipelines and high-throughput data processing systems, which is precisely the work described in this role. Her additional experience with Go, Terraform, and Redis covers your nice-to-have requirements as well.'
);

-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

-- Conversation for Alice's Acme application (shortlisted, active conversation)
INSERT INTO conversations (id, application_id) VALUES
  ('aaa00000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001');

INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES
  ('aaa00000-0000-0000-0000-000000000001', 'agent', 'I am writing on behalf of Alice Johnson to express strong interest in the Senior Full Stack Engineer position at Acme Corp. Alice brings 6 years of experience building scalable web applications with React, TypeScript, Node.js, and PostgreSQL—precisely the stack your team uses.', NOW() - INTERVAL '3 days'),
  ('aaa00000-0000-0000-0000-000000000001', 'employer', 'Thanks for the application! Can you tell us more about the microservices migration Alice led? What was the scale and what challenges did the team face?', NOW() - INTERVAL '2 days'),
  ('aaa00000-0000-0000-0000-000000000001', 'agent', 'Great question! Alice led the migration of a monolithic Rails application to 12 Node.js microservices serving 2M users at Stripe. The main challenges were maintaining zero downtime during the transition, designing service boundaries, and implementing distributed tracing. The project took 8 months and reduced deploy times from 45 minutes to under 5 minutes per service.', NOW() - INTERVAL '2 days'),
  ('aaa00000-0000-0000-0000-000000000001', 'employer', 'Impressive. We would like to schedule a call with Alice. Is she available next week Tuesday or Wednesday afternoon PST?', NOW() - INTERVAL '1 day'),
  ('aaa00000-0000-0000-0000-000000000001', 'agent', 'Alice is available both Tuesday and Wednesday afternoon PST. She would prefer Tuesday at 2pm if that works for your team. Please share a calendar invite or video call link and she will be there.', NOW() - INTERVAL '1 day');

-- Conversation for Alice's Startup.io application (reviewing)
INSERT INTO conversations (id, application_id) VALUES
  ('aaa00000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000002');

INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES
  ('aaa00000-0000-0000-0000-000000000002', 'agent', 'Alice Johnson is an excellent fit for the Founding Engineer role at Startup.io. With 6 years as a full stack engineer, she has the generalist profile you are looking for.', NOW() - INTERVAL '2 days'),
  ('aaa00000-0000-0000-0000-000000000002', 'employer', 'We love Alice''s background! Quick question—has she worked with any AI/ML tools or LLM APIs before?', NOW() - INTERVAL '1 day'),
  ('aaa00000-0000-0000-0000-000000000002', 'agent', 'Alice has integrated OpenAI and Anthropic APIs into production applications and has experience with prompt engineering and RAG architectures. While ML engineering isn''t her primary focus, she is comfortable building AI-powered features and is eager to go deeper in that area. I will check with Alice for more specific details and get back to you.', NOW() - INTERVAL '1 day');

-- Conversation for Bob's Acme application (pending)
INSERT INTO conversations (id, application_id) VALUES
  ('aaa00000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000003');

INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES
  ('aaa00000-0000-0000-0000-000000000003', 'agent', 'I am reaching out on behalf of Bob Martinez regarding the Frontend Engineer position at Acme Corp. Bob is a frontend specialist with 3 years of experience in React, TypeScript, and CSS.', NOW() - INTERVAL '6 hours');

-- Conversation for Carol's Acme application (interview scheduled)
INSERT INTO conversations (id, application_id) VALUES
  ('aaa00000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000004');

INSERT INTO messages (conversation_id, sender_type, content, created_at) VALUES
  ('aaa00000-0000-0000-0000-000000000004', 'agent', 'Carol Chen is an outstanding match for the Backend Platform Engineer role at Acme Corp. With 8 years of backend engineering experience, she has deep expertise in Python, PostgreSQL, Kafka, and Kubernetes.', NOW() - INTERVAL '5 days'),
  ('aaa00000-0000-0000-0000-000000000004', 'employer', 'Carol looks like a great fit. Can she share more about the Kafka pipelines she built? What throughput were they handling?', NOW() - INTERVAL '4 days'),
  ('aaa00000-0000-0000-0000-000000000004', 'agent', 'Carol''s Kafka pipelines at her previous company processed approximately 500K events per second across 15 topics. She designed the schema registry, implemented exactly-once delivery semantics, and built monitoring dashboards. The system handled real-time analytics for a fintech product with strict latency requirements under 100ms p99.', NOW() - INTERVAL '4 days'),
  ('aaa00000-0000-0000-0000-000000000004', 'employer', 'That is exactly the scale we are dealing with. Let us set up a technical interview. Would Thursday at 11am PST work?', NOW() - INTERVAL '3 days'),
  ('aaa00000-0000-0000-0000-000000000004', 'agent', 'Thursday at 11am PST works perfectly for Carol. She is looking forward to the conversation. Please send over the video call link and any prep materials, and she will be ready.', NOW() - INTERVAL '3 days'),
  ('aaa00000-0000-0000-0000-000000000004', 'system', 'Interview scheduled for Thursday at 11:00 AM PST.', NOW() - INTERVAL '3 days');

-- ============================================
-- RATINGS (for Carol, who has been through the process before)
-- ============================================

INSERT INTO ratings (job_seeker_id, employer_id, application_id, score, feedback) VALUES
  ('c3000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000004', 5, 'Excellent candidate. Agent communication was professional and accurate. Carol''s technical depth matched exactly what the agent described.');

-- ============================================
-- AGENT MAPPINGS (for webhook integration)
-- ============================================

-- Alice has a hosted agent
INSERT INTO agent_mappings (user_id, agent_id, agent_hosting) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'agent-alice-001', 'hosted');

-- Carol has a hosted agent
INSERT INTO agent_mappings (user_id, agent_id, agent_hosting) VALUES
  ('a1000000-0000-0000-0000-000000000003', 'agent-carol-001', 'hosted');

-- Bob uses BYOA (no webhooks)
INSERT INTO agent_mappings (user_id, agent_id, agent_hosting) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'external-bob-agent', 'byoa');

-- Acme Corp employer has a hosted agent
INSERT INTO agent_mappings (user_id, agent_id, agent_hosting) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'agent-acme-001', 'hosted');

-- Update application counters
UPDATE job_seekers SET applications_today = 2, last_application_date = CURRENT_DATE WHERE id = 'c3000000-0000-0000-0000-000000000001';
UPDATE job_seekers SET applications_today = 1, last_application_date = CURRENT_DATE WHERE id = 'c3000000-0000-0000-0000-000000000002';
UPDATE job_seekers SET applications_today = 1, last_application_date = CURRENT_DATE WHERE id = 'c3000000-0000-0000-0000-000000000003';
