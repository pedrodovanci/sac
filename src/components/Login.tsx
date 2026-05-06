'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import logoCcc from '../../images/LOGO CCC.jpg';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.target as HTMLFormElement);
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError('Credenciais inválidas');
      return;
    }

    onLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-container-low">
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant overflow-hidden relative"
      >
        <div className="h-2 bg-primary w-full" />
        
        <div className="p-8 sm:p-10 flex flex-col gap-8">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-full flex items-center justify-center mb-2">
              <Image
                src={logoCcc}
                alt="Centro Cérebro Coluna"
                priority
                className="h-16 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-on-surface">SAC Cerebro e Coluna</h1>
            <p className="text-sm text-on-surface-variant">Acesso ao Sistema</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-error-container/20 border border-error-container p-4 rounded-lg flex items-start gap-3"
            >
              <ShieldAlert className="text-error h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-on-error-container">{error}</p>
                <p className="text-xs text-on-error-container/80 mt-1">Por favor, verifique seu e-mail e senha e tente novamente.</p>
              </div>
            </motion.div>
          )}

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface" htmlFor="email">E-mail corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5" />
                <input 
                  className="w-full bg-surface pl-10 pr-4 py-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-on-surface-variant/50"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="usuario@empresa.com.br"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-on-surface" htmlFor="password">Senha</label>
                <a className="text-xs text-primary hover:text-primary-container transition-colors font-medium" href="#">Esqueceu a senha?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5" />
                <input 
                  className="w-full bg-surface pl-10 pr-12 py-3 rounded-lg border border-outline-variant text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-on-surface-variant/50"
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <button 
                className="w-full bg-primary text-on-primary py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
              </button>
            </div>
          </form>
        </div>
      </motion.main>
    </div>
  );
}
