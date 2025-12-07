-- Create roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create services table (cortes/serviços)
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services"
ON public.services FOR SELECT
USING (active = true);

CREATE POLICY "Admins can manage services"
ON public.services FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create time_slots table (horários disponíveis)
CREATE TABLE public.time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_time TIME NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view time slots"
ON public.time_slots FOR SELECT
USING (true);

CREATE POLICY "Admins can manage time slots"
ON public.time_slots FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create blocked_dates table (datas específicas bloqueadas)
CREATE TABLE public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocked_date DATE NOT NULL,
    blocked_time TIME,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked dates"
ON public.blocked_dates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage blocked dates"
ON public.blocked_dates FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create appointments table (agendamentos)
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    payment_method TEXT DEFAULT 'pix',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all appointments"
ON public.appointments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for profiles on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default services
INSERT INTO public.services (name, description, price, duration_minutes) VALUES
('Corte Tradicional', 'Corte clássico masculino com acabamento perfeito', 35.00, 30),
('Corte + Barba', 'Corte tradicional com barba completa', 55.00, 45),
('Barba Completa', 'Modelagem e acabamento de barba', 25.00, 20),
('Corte Degradê', 'Corte moderno com degradê personalizado', 40.00, 35),
('Corte + Sobrancelha', 'Corte tradicional com design de sobrancelha', 45.00, 35),
('Tratamento Capilar', 'Hidratação e tratamento para cabelos', 50.00, 40);

-- Insert default time slots (9h às 19h, segunda a sábado)
INSERT INTO public.time_slots (slot_time, day_of_week) VALUES
-- Segunda (1)
('09:00', 1), ('09:30', 1), ('10:00', 1), ('10:30', 1), ('11:00', 1), ('11:30', 1),
('13:00', 1), ('13:30', 1), ('14:00', 1), ('14:30', 1), ('15:00', 1), ('15:30', 1),
('16:00', 1), ('16:30', 1), ('17:00', 1), ('17:30', 1), ('18:00', 1), ('18:30', 1),
-- Terça (2)
('09:00', 2), ('09:30', 2), ('10:00', 2), ('10:30', 2), ('11:00', 2), ('11:30', 2),
('13:00', 2), ('13:30', 2), ('14:00', 2), ('14:30', 2), ('15:00', 2), ('15:30', 2),
('16:00', 2), ('16:30', 2), ('17:00', 2), ('17:30', 2), ('18:00', 2), ('18:30', 2),
-- Quarta (3)
('09:00', 3), ('09:30', 3), ('10:00', 3), ('10:30', 3), ('11:00', 3), ('11:30', 3),
('13:00', 3), ('13:30', 3), ('14:00', 3), ('14:30', 3), ('15:00', 3), ('15:30', 3),
('16:00', 3), ('16:30', 3), ('17:00', 3), ('17:30', 3), ('18:00', 3), ('18:30', 3),
-- Quinta (4)
('09:00', 4), ('09:30', 4), ('10:00', 4), ('10:30', 4), ('11:00', 4), ('11:30', 4),
('13:00', 4), ('13:30', 4), ('14:00', 4), ('14:30', 4), ('15:00', 4), ('15:30', 4),
('16:00', 4), ('16:30', 4), ('17:00', 4), ('17:30', 4), ('18:00', 4), ('18:30', 4),
-- Sexta (5)
('09:00', 5), ('09:30', 5), ('10:00', 5), ('10:30', 5), ('11:00', 5), ('11:30', 5),
('13:00', 5), ('13:30', 5), ('14:00', 5), ('14:30', 5), ('15:00', 5), ('15:30', 5),
('16:00', 5), ('16:30', 5), ('17:00', 5), ('17:30', 5), ('18:00', 5), ('18:30', 5),
-- Sábado (6)
('09:00', 6), ('09:30', 6), ('10:00', 6), ('10:30', 6), ('11:00', 6), ('11:30', 6),
('13:00', 6), ('13:30', 6), ('14:00', 6), ('14:30', 6), ('15:00', 6), ('15:30', 6),
('16:00', 6), ('16:30', 6), ('17:00', 6), ('17:30', 6);