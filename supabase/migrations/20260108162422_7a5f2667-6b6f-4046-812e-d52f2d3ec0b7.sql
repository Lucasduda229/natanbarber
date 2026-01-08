-- Adicionar campo subscribers_only aos serviços
ALTER TABLE services ADD COLUMN IF NOT EXISTS subscribers_only BOOLEAN DEFAULT false;

-- Tabela de benefícios de cada pacote (serviços incluídos com quantidade)
CREATE TABLE IF NOT EXISTS package_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(package_id, service_id)
);

-- Assinaturas ativas dos clientes
CREATE TABLE IF NOT EXISTS client_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_id UUID NOT NULL REFERENCES packages(id),
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Registro de uso dos benefícios
CREATE TABLE IF NOT EXISTS client_package_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_package_id UUID NOT NULL REFERENCES client_packages(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  appointment_id UUID,
  used_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE package_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_package_usage ENABLE ROW LEVEL SECURITY;

-- Policies para package_benefits
CREATE POLICY "Anyone can view package benefits" ON package_benefits
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage package benefits" ON package_benefits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para client_packages
CREATE POLICY "Users can view their own packages" ON client_packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own packages" ON client_packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all client packages" ON client_packages
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para client_package_usage
CREATE POLICY "Users can view their own usage" ON client_package_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_packages cp 
      WHERE cp.id = client_package_usage.client_package_id 
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own usage" ON client_package_usage
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_packages cp 
      WHERE cp.id = client_package_usage.client_package_id 
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all usage" ON client_package_usage
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_client_packages_updated_at
  BEFORE UPDATE ON client_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Adicionar duration_days e discount_percent ao packages se não existir
ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;