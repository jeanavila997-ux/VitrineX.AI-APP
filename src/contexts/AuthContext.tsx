import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getAuthRedirectTo, isSupabaseConfigured, supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { getUserProfile } from '../services/core/db';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    /** Retorna mensagem opcional (ex.: confirme o e-mail). */
    signUp: (
        email: string,
        password: string,
        metadata?: Record<string, unknown>
    ) => Promise<{ needsEmailConfirmation?: boolean; message?: string }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            if (!isSupabaseConfigured) {
                if (localStorage.getItem('mock_session')) {
                    const mockUser: User = {
                        id: 'mock-user-123',
                        app_metadata: {},
                        user_metadata: { full_name: 'Usuário Demo' },
                        aud: 'authenticated',
                        created_at: new Date().toISOString(),
                    };
                    setUser(mockUser);
                    setSession({
                        access_token: 'mock-token',
                        refresh_token: 'mock-refresh',
                        expires_in: 3600,
                        token_type: 'bearer',
                        user: mockUser,
                    });
                }
                if (mounted) setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (mounted) {
                    setSession(data.session);
                    setUser(data.session?.user ?? null);
                    if (data.session?.user) {
                        await loadProfile(data.session.user.id, data.session.user.email);
                    } else {
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                if (mounted) setLoading(false);
            }
        };

        void initAuth();

        let subscription: { unsubscribe: () => void } | null = null;
        if (isSupabaseConfigured) {
            try {
                const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
                    if (!mounted) return;
                    setSession(nextSession);
                    setUser(nextSession?.user ?? null);

                    if (nextSession?.user) {
                        void loadProfile(nextSession.user.id, nextSession.user.email);
                    } else {
                        setProfile(null);
                        setLoading(false);
                    }
                });
                subscription = data.subscription;
            } catch (e) {
                console.warn('onAuthStateChange failed', e);
            }
        }

        return () => {
            mounted = false;
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const loadProfile = async (userId: string, email?: string) => {
        try {
            let userProfile = await getUserProfile(userId);

            if (!userProfile && email) {
                // Trigger ainda não criou a linha — perfil mínimo até o próximo refresh
                userProfile = {
                    id: userId,
                    email,
                    name: email.split('@')[0],
                    plan: 'free',
                    role: 'VIEWER',
                    credits: 50,
                    businessProfile: {
                        name: '',
                        industry: '',
                        targetAudience: '',
                        visualStyle: '',
                    },
                };
            }

            if (
                email === 'jeancarlosmedvet97@outlook.com' ||
                userProfile?.email === 'jeancarlosmedvet97@outlook.com'
            ) {
                userProfile = {
                    ...(userProfile as UserProfile),
                    role: 'ADMIN' as UserProfile['role'],
                    email: 'jeancarlosmedvet97@outlook.com',
                };
            }

            setProfile(userProfile);
        } catch (error) {
            console.error('Error loading user profile:', error);
            if (email === 'jeancarlosmedvet97@outlook.com') {
                setProfile({
                    id: userId,
                    name: 'Jean Carlos',
                    email,
                    role: 'ADMIN' as UserProfile['role'],
                    avatar: '',
                    plan: 'enterprise',
                    businessProfile: {
                        name: 'VitrineX',
                        industry: 'Tech',
                        targetAudience: 'General',
                        visualStyle: 'Modern',
                    },
                    credits: 9999,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, password: string) => {
        if (!isSupabaseConfigured) {
            console.log('Mode: Mock Login');

            const isAdmin = email.toLowerCase() === 'jeancarlosmedvet97@outlook.com';

            const mockUser: User = {
                id: isAdmin ? 'admin-jean-id' : 'mock-user-123',
                app_metadata: {},
                user_metadata: { full_name: isAdmin ? 'Jean Carlos' : 'Usuário Demo' },
                aud: 'authenticated',
                created_at: new Date().toISOString(),
                email,
            };

            setUser(mockUser);
            setSession({
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                expires_in: 3600,
                token_type: 'bearer',
                user: mockUser,
            });

            setProfile({
                id: mockUser.id,
                name: mockUser.user_metadata.full_name,
                email,
                role: (isAdmin ? 'ADMIN' : 'VIEWER') as UserProfile['role'],
                avatar: '',
                plan: isAdmin ? 'enterprise' : 'free',
                businessProfile: {
                    name: 'Demo Business',
                    industry: 'Retail',
                    targetAudience: 'Everyone',
                    visualStyle: 'Standard',
                },
                credits: isAdmin ? 9999 : 50,
            });

            localStorage.setItem('mock_session', JSON.stringify({ user: mockUser, isAdmin }));
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (
        email: string,
        password: string,
        metadata?: Record<string, unknown>
    ): Promise<{ needsEmailConfirmation?: boolean; message?: string }> => {
        if (!isSupabaseConfigured) {
            console.log('Mode: Mock Signup');
            await signIn(email, password);
            return { message: 'Conta demo criada (modo local).' };
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
                emailRedirectTo: getAuthRedirectTo(),
            },
        });
        if (error) throw error;

        // Confirmação de e-mail ligada → session null até clicar no link
        if (!data.session) {
            return {
                needsEmailConfirmation: true,
                message:
                    'Cadastro criado. Confira seu e-mail para confirmar a conta (ou desative “Confirm email” no dashboard do Supabase para testes).',
            };
        }

        return { message: 'Conta criada com sucesso.' };
    };

    const signOut = async () => {
        if (!isSupabaseConfigured) {
            setUser(null);
            setSession(null);
            setProfile(null);
            localStorage.removeItem('mock_session');
            localStorage.removeItem('vitrinex_mock_profile');
            return;
        }
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
