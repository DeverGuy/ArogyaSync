-- Create patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    blood_group TEXT,
    gender TEXT,
    phone TEXT,
    emergency_phone TEXT,
    height NUMERIC,
    weight NUMERIC,
    age INTEGER,
    vitals JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create queue table
CREATE TABLE queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    triage_status TEXT NOT NULL CHECK (triage_status IN ('Red', 'Yellow', 'Green')),
    survival_info TEXT,
    status TEXT NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'In Progress', 'Completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is local and we don't have auth setup yet)
-- In a real production app, we would restrict this to authenticated ASHA workers / Doctors.
CREATE POLICY "Allow public read access on patients" ON patients FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on patients" ON patients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on patients" ON patients FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on queue" ON queue FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on queue" ON queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on queue" ON queue FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on queue" ON queue FOR DELETE USING (true);

-- Enable Realtime for the queue table
ALTER PUBLICATION supabase_realtime ADD TABLE queue;
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
