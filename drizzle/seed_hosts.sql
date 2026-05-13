INSERT INTO `hosts` (`id`, `name`, `persona_description`, `expertise`, `tone`, `background`, `chemistry`, `domain`, `headshot_url`, `affiliation`, `sex`) VALUES 
('c53f3e1a-5b12-4c2b-b413-5a0a382e2c56', 'Andrea Longton, CFA', 'Award-winning author who recently published The Social Justice Investor, a guide for people who want to align their financial decisions with their commitments to social justice.', '["Social Justice Investing", "Community Finance"]', 'Warm, analytical, mission-driven', 'Author, Financial Professional', '["Ebony Perkins", "Leah Fremouw"]', '["Finance", "Social Justice"]', 'https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/6f2daf95-ebe6-4a2c-8273-582a75327a92/Longton_Andrea_Photo+2000+pixels.jpg?format=500w', 'Renegade Capital', 'F'),
('a37e1b2f-9023-4d4e-b81f-7b56d3c2e1f4', 'Ebony Perkins', 'Community finance executive with a solutions-oriented vision. Currently the Managing Director of Capital Strategy at a national CDFI.', '["Capital Strategy", "Community Finance", "CDFI"]', 'Solutions-oriented, engaging, visionary', 'Managing Director of Capital Strategy', '["Andrea Longton", "Leah Fremouw"]', '["Finance", "Community Development"]', 'https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/460838df-c592-4a26-898f-53aeb54a654e/ebony.jpeg?format=750w', 'Renegade Capital', 'F'),
('f81d4a5b-8e27-4c3f-b2a1-6d45e9f8b7c3', 'Leah Fremouw', 'CEO of a Community Development Financial Institution with a deep background in listening to communities for the best insights to sustainable initiatives.', '["Community Insights", "Sustainable Initiatives", "CDFI"]', 'Insightful, grounded, empathetic', 'CEO of a CDFI', '["Andrea Longton", "Ebony Perkins"]', '["Community Development", "Finance"]', 'https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/a6dd99ca-64d7-4207-8eff-ca7c95d8f731/Leah+2023.jpg?format=500w', 'Renegade Capital', 'F')
ON CONFLICT(id) DO UPDATE SET 
name=excluded.name, 
persona_description=excluded.persona_description, 
expertise=excluded.expertise, 
tone=excluded.tone, 
background=excluded.background, 
chemistry=excluded.chemistry, 
domain=excluded.domain, 
headshot_url=excluded.headshot_url, 
affiliation=excluded.affiliation, 
sex=excluded.sex;
