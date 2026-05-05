-- Seed data for the database

-- Insert demo users (password: "password123" hashed with SHA-256)
INSERT INTO users (email, password_hash, name) VALUES
('admin@example.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Admin User'),
('demo@example.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Demo User');

-- Insert dashboard metrics
INSERT INTO dashboard_metrics (metric_name, metric_value, metric_type, category) VALUES
('Total Users', 1250, 'count', 'users'),
('Active Users', 823, 'count', 'users'),
('User Growth Rate', 15.3, 'percentage', 'users'),
('Monthly Revenue', 45678.90, 'currency', 'revenue'),
('Revenue Growth', 8.5, 'percentage', 'revenue'),
('API Response Time', 145, 'time', 'performance'),
('Cache Hit Rate', 87.5, 'percentage', 'performance'),
('Database Load', 34.2, 'percentage', 'system'),
('CPU Usage', 23.8, 'percentage', 'system'),
('Memory Usage', 56.3, 'percentage', 'system'),
('Total Requests', 125430, 'count', 'performance'),
('Error Rate', 0.23, 'percentage', 'performance'),
('Success Rate', 99.77, 'percentage', 'performance'),
('Average Session Time', 342, 'time', 'users'),
('Conversion Rate', 4.2, 'percentage', 'revenue');

-- Insert sample health checks
INSERT INTO health_checks (service_name, status, response_time) VALUES
('api', 'healthy', 45),
('database', 'healthy', 12),
('workers-ai', 'healthy', 234),
('ai-gateway', 'healthy', 89),
('cdn', 'healthy', 23);

-- Insert sample notifications
INSERT INTO notifications (user_id, type, title, message, is_read) VALUES
(1, 'info', 'Welcome!', 'Welcome to the platform. Your account has been created successfully.', false),
(1, 'success', 'System Update', 'The system has been successfully updated to version 2.0.', false),
(1, 'warning', 'High Traffic', 'Your API is experiencing higher than normal traffic.', true),
(2, 'info', 'New Feature', 'Check out our new AI assistant features!', false),
(2, 'success', 'Task Completed', 'Your background task has completed successfully.', true);

-- Insert sample threads
INSERT INTO threads (user_id, title) VALUES
(1, 'Getting Started with AI'),
(1, 'Project Planning Discussion'),
(2, 'Technical Support Request');

-- Insert sample messages
INSERT INTO messages (thread_id, role, content) VALUES
(1, 'user', 'Hello! Can you help me understand how to use the AI features?'),
(1, 'assistant', 'Of course! I''d be happy to help you get started with our AI features. We have several capabilities including chat, speech-to-text, and text-to-speech. What would you like to explore first?'),
(1, 'user', 'I''m interested in the speech-to-text feature.'),
(2, 'user', 'I need to plan a new project. Can you help me outline the key steps?'),
(2, 'assistant', 'Absolutely! Let''s break down your project planning into key phases: 1) Define objectives, 2) Identify stakeholders, 3) Set timeline, 4) Allocate resources, 5) Risk assessment. Which phase would you like to focus on first?'),
(3, 'user', 'I''m having trouble connecting to the API.'),
(3, 'assistant', 'I can help you troubleshoot that. Can you provide more details about the error you''re seeing?');

-- Insert sample documents
INSERT INTO documents (user_id, title, content) VALUES
(1, 'Project Overview', '[{"type":"paragraph","children":[{"text":"This is a sample project overview document."}]}]'),
(1, 'Meeting Notes', '[{"type":"paragraph","children":[{"text":"Meeting notes from today..."}]}]'),
(2, 'Technical Specification', '[{"type":"paragraph","children":[{"text":"Technical specifications for the new feature."}]}]');

-- Insert podcast guests
INSERT INTO guests (name, persona_description, expertise, tone, background, chemistry, domain, headshot_url, affiliation) VALUES
('Dr. Safiya Noble', 'Scholar who exposed how search algorithms reinforce racial and gender bias', '["Algorithmic Bias", "Digital Discrimination", "Information Systems"]', 'Academic yet accessible, urgent without being alarmist', 'Author of "Algorithms of Oppression", Professor at UCLA', '["Algorithmic Interrogators", "Scholar-Activists"]', '["AI Ethics", "Social Justice", "Technology"]', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop', 'UCLA'),
('Ruha Benjamin', 'Sociologist examining technology as "The New Jim Code"', '["Race and Technology", "Design Justice", "Carceral Tech"]', 'Sharp, poetic, challenges assumptions without alienating', 'Author of "Race After Technology", Princeton Professor', '["Scholar-Activists", "Algorithmic Interrogators"]', '["AI Ethics", "Social Justice", "Technology"]', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop', 'Princeton University'),
('Timnit Gebru', 'AI researcher who stood up to Big Tech on ethical AI', '["AI Ethics", "Algorithmic Fairness", "Large Language Models"]', 'Principled, uncompromising, deeply technical', 'Former Google AI ethics co-lead, Founder of DAIR', '["Practitioner-Ethicists", "Algorithmic Interrogators"]', '["AI Ethics", "Technology", "Finance"]', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=400&fit=crop', 'DAIR Institute'),
('Joy Buolamwini', 'Poet of Code exposing facial recognition bias', '["Computer Vision", "Algorithmic Justice", "AI Policy"]', 'Poetic, visual, makes the technical deeply human', 'Founder of Algorithmic Justice League, MIT researcher', '["Practitioner-Ethicists", "Artist-Engineers"]', '["AI Ethics", "Social Justice", "Technology"]', 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop', 'MIT Media Lab'),
('Cathy O''Neil', 'Data scientist who became a WMD (Weapons of Math Destruction) whistleblower', '["Predictive Policing", "Credit Scoring", "Algorithmic Accountability"]', 'Direct, no-nonsense, translates math into moral stakes', 'Author of "Weapons of Math Destruction", Former hedge fund quant', '["Practitioner-Ethicists", "Finance-Justice Bridge"]', '["AI Ethics", "Finance", "Social Justice"]', 'https://images.unsplash.com/photo-1590086782957-93c06ef21604?w=400&h=400&fit=crop', 'ORCAA'),
('Arlan Hamilton', 'VC democratizing access to startup capital', '["Venture Capital", "Fund Management", "DEI in Tech"]', 'Charismatic, pragmatic, unapologetically ambitious', 'Founder of Backstage Capital, LGBTQ+ advocate', '["Finance-Justice Bridge", "Builder-Visionaries"]', '["Finance", "Social Justice", "Technology"]', 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=400&fit=crop', 'Backstage Capital'),
('Vartan Gregorian', 'Philanthropist rethinking capital allocation for equity', '["Impact Investing", "Community Development", "Educational Equity"]', 'Thoughtful, diplomatic, sees long arcs of change', 'President Emeritus of Carnegie Corporation', '["Finance-Justice Bridge", "Scholar-Activists"]', '["Finance", "Social Justice"]', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', 'Carnegie Corporation'),
('Andrea Longton', 'Author of "The Social Justice Investor"', '["Ethical Investing", "ESG Analysis", "Community Finance"]', 'Empowering, practical, makes finance accessible', 'Financial advisor specializing in values-aligned portfolios', '["Finance-Justice Bridge", "Practitioner-Ethicists"]', '["Finance", "Social Justice"]', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop', 'Independent');
