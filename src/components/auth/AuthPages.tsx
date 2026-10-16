import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faLock,
  faUser,
  faGlobe,
  faArrowRight,
  faCircleCheck,
  faKey,
  faEye,
  faEyeSlash,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../ui/ToastContext';
import { PichFlowLogo } from '../ui/PichFlowLogo';
import { apiClient } from '../../lib/api';

interface AuthPageProps {
  onNavigate: (route: string) => void;
  initialView?: 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';
}

export const AuthPages: React.FC<AuthPageProps> = ({ onNavigate, initialView = 'login' }) => {
  const [view, setView] = useState<'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password'>(initialView);
  const { showToast } = useToast();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('BJ');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient.auth.login(email, password);
      showToast('Connexion réussie ! Bienvenue sur PichFlow.', 'success');
      onNavigate('/dashboard/apps');
    } catch (err: any) {
      if (err.message && (err.message.includes('pas encore confirmée') || err.message.includes('code de vérification'))) {
        showToast(err.message, 'warning');
        setView('verify-email');
      } else {
        showToast(err.message || 'Identifiants incorrects.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }
    if (!termsAccepted) {
      showToast('Veuillez accepter les conditions d’utilisation.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiClient.auth.register({
        email,
        password,
        fullName: name,
        country,
      });
      if (res.requireVerification) {
        showToast('Compte créé ! Veuillez saisir le code de confirmation reçu par e-mail.', 'info');
        setVerificationCode('');
        setView('verify-email');
      } else {
        showToast('Compte créé avec succès ! Bienvenue sur PichFlow.', 'success');
        onNavigate('/dashboard/apps');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la création du compte.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setVerificationError('Veuillez saisir le code à 6 chiffres.');
      return;
    }
    setIsLoading(true);
    setVerificationError('');
    try {
      await apiClient.auth.verifyCode(email, verificationCode.trim());
      showToast('Adresse email confirmée avec succès ! Bienvenue.', 'success');
      onNavigate('/dashboard/apps');
    } catch (err: any) {
      setVerificationError(err.message || 'Code erroné ou expiré.');
      showToast(err.message || 'Code erroné ou expiré.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      showToast('Adresse e-mail introuvable.', 'error');
      return;
    }
    setIsResending(true);
    setVerificationError('');
    try {
      const res = await apiClient.auth.resendCode(email);
      showToast(res.message || 'Nouveau code envoyé par e-mail.', 'success');
      setVerificationCode('');
    } catch (err: any) {
      showToast(err.message || 'Impossible de renvoyer le code.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await apiClient.auth.forgotPassword(email);
      setResetCode('');
      setResetPassword('');
      showToast(result.message, 'info');
      setView('reset-password');
    } catch (err: any) {
      showToast(err.message || 'Impossible de demander la réinitialisation du mot de passe.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await apiClient.auth.resetPassword(email, resetCode, resetPassword);
      showToast(result.message, 'success');
      setView('login');
    } catch (err: any) {
      showToast(err.message || 'Impossible de réinitialiser le mot de passe.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2F6 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1rem',
    }}>
      {/* Centered Clean Card */}
      <div style={{
        maxWidth: view === 'register' ? '580px' : '460px',
        width: '100%',
        background: '#FFFFFF',
        borderRadius: '1rem',
        border: '1px solid #E2E8F0',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        padding: '2.5rem 2rem',
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button
            onClick={() => onNavigate('/')}
            style={{ cursor: 'pointer', margin: '0 auto 1.25rem auto', background: 'none', border: 'none', padding: 0 }}
            aria-label="PichFlow Accueil"
          >
            <PichFlowLogo size="lg" />
          </button>

          {view === 'login' && (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>
                Se connecter
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
                Accédez à votre espace marchand PichFlow
              </p>
            </>
          )}

          {view === 'register' && (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>
                Créer un compte
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
                Rejoignez l'infrastructure de paiement moderne pour l'Afrique
              </p>
            </>
          )}

          {view === 'verify-email' && (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>
                Vérification de l’email
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
                Saisissez le code de confirmation reçu par e-mail
              </p>
            </>
          )}

          {view === 'forgot-password' && (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>
                Mot de passe oublié
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
                Saisissez votre e-mail pour recevoir les instructions
              </p>
            </>
          )}

          {view === 'reset-password' && (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>
                Nouveau mot de passe
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
                Choisissez un mot de passe robuste et sécurisé
              </p>
            </>
          )}
        </div>

        {/* 1. LOGIN FORM */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div className="pf-form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="pf-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Email professionnel
              </label>
              <div className="pf-input-wrapper" style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  type="email"
                  className="pf-input"
                  style={{ width: '100%', paddingLeft: '2.5rem', height: '2.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.9375rem' }}
                  placeholder="nom@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pf-form-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="pf-label" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setView('forgot-password')}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#2563EB', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="pf-input-wrapper" style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                  <FontAwesomeIcon icon={faLock} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="pf-input"
                  style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem', height: '2.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.9375rem' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '0.25rem',
                  }}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="pf-btn pf-btn-primary"
              style={{
                width: '100%',
                height: '2.875rem',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{isLoading ? 'Connexion en cours...' : 'Se connecter'}</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#64748B' }}>
              Pas encore inscrit ?{' '}
              <button
                type="button"
                onClick={() => setView('register')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#2563EB', fontWeight: 700, cursor: 'pointer' }}
              >
                Créer un compte
              </button>
            </div>
          </form>
        )}

        {/* 2. REGISTER FORM */}
        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            {/* Row 1: Nom complet & Email professionnel sur la même ligne sur grands écrans */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                  Nom complet
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <input
                    type="text"
                    style={{ width: '100%', paddingLeft: '2.5rem', height: '2.625rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                    placeholder="Alexandre Dossou"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                  Email professionnel
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                  <input
                    type="email"
                    style={{ width: '100%', paddingLeft: '2.5rem', height: '2.625rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                    placeholder="contact@entreprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Pays principal */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Pays d'activité principal
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                  <FontAwesomeIcon icon={faGlobe} />
                </span>
                <select
                  style={{ width: '100%', paddingLeft: '2.5rem', height: '2.625rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem', background: '#FFFFFF' }}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="BJ">Bénin (+229) · XOF</option>
                  <option value="CI">Côte d'Ivoire (+225) · XOF</option>
                  <option value="SN">Sénégal (+221) · XOF</option>
                  <option value="TG">Togo (+228) · XOF</option>
                  <option value="BF">Burkina Faso (+226) · XOF</option>
                  <option value="CM">Cameroun (+237) · XAF</option>
                </select>
              </div>
            </div>

            {/* Row 2: Mot de passe & Confirmation */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.25rem', height: '2.625rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                    placeholder="Min. 8 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    style={{
                      position: 'absolute',
                      right: '0.625rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '0.25rem',
                    }}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                  Confirmer le mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.25rem', height: '2.625rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                    placeholder="Confirmer"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                    style={{
                      position: 'absolute',
                      right: '0.625rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '0.25rem',
                    }}
                  >
                    <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
            </div>

            {/* Checkbox Obligatoire : Conditions & Confidentialité */}
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#F8FAFC', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                <input
                  type="checkbox"
                  style={{ marginTop: '0.2rem', accentColor: '#2563EB', width: '1rem', height: '1rem', cursor: 'pointer' }}
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                />
                <span>
                  J'accepte les{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/mentions-legales')}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#2563EB', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    conditions d'utilisation
                  </button>{' '}
                  et la{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/politique-de-confidentialite')}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#2563EB', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    politique de confidentialité
                  </button>{' '}
                  de PichFlow.
                </span>
              </label>
            </div>

            {/* Bouton d'inscription DÉSACTIVÉ tant que termsAccepted n'est pas coché */}
            <button
              type="submit"
              disabled={isLoading || !termsAccepted}
              className="pf-btn pf-btn-primary"
              style={{
                width: '100%',
                height: '2.875rem',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: !termsAccepted || isLoading ? 'not-allowed' : 'pointer',
                opacity: !termsAccepted ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{isLoading ? 'Création en cours...' : 'Créer mon compte'}</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: '#64748B' }}>
              Vous avez déjà un compte ?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#2563EB', fontWeight: 700, cursor: 'pointer' }}
              >
                Se connecter
              </button>
            </div>
          </form>
        )}

        {/* 3. VERIFY EMAIL SCREEN */}
        {view === 'verify-email' && (
          <form onSubmit={handleVerifyCodeSubmit}>
            <div style={{
              padding: '0.875rem 1rem',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '0.5rem',
              color: '#1E40AF',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
            }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ marginTop: '0.15rem' }} />
              <div>
                Un code de confirmation à 6 chiffres a été envoyé à <strong>{email || 'votre adresse email'}</strong>.
              </div>
            </div>

            {verificationError && (
              <div style={{
                padding: '0.75rem 1rem',
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '0.5rem',
                color: '#991B1B',
                fontSize: '0.875rem',
                marginBottom: '1.25rem',
              }}>
                {verificationError}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Code de confirmation reçu (6 chiffres)
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                placeholder="Ex: 849201"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%',
                  height: '3.25rem',
                  fontSize: '1.5rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  fontWeight: 700,
                  borderRadius: '0.5rem',
                  border: '2px solid #2563EB',
                  background: '#F8FAFC',
                  color: '#0F172A',
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || verificationCode.length < 6}
              className="pf-btn pf-btn-primary"
              style={{
                width: '100%',
                height: '2.875rem',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: verificationCode.length < 6 || isLoading ? 'not-allowed' : 'pointer',
                opacity: verificationCode.length < 6 ? 0.6 : 1,
              }}
            >
              <span>{isLoading ? 'Vérification...' : 'Confirmer mon compte'}</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', fontSize: '0.8125rem' }}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                style={{ background: 'none', border: 'none', padding: 0, color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}
              >
                {isResending ? 'Envoi en cours...' : 'Renvoyer un nouveau code'}
              </button>

              <button
                type="button"
                onClick={() => setView('login')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#64748B', cursor: 'pointer' }}
              >
                Retour à la connexion
              </button>
            </div>
          </form>
        )}

        {/* 4. FORGOT PASSWORD */}
        {view === 'forgot-password' && (
          <form onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Adresse e-mail du compte
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  type="email"
                  style={{ width: '100%', paddingLeft: '2.5rem', height: '2.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.9375rem' }}
                  placeholder="votre-email@entreprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="pf-btn pf-btn-primary"
              style={{ width: '100%', height: '2.875rem', borderRadius: '0.5rem', fontWeight: 700 }}
            >
              <span>{isLoading ? 'Envoi...' : 'Envoyer les instructions'}</span>
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setView('login')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#64748B', fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Annuler et revenir à la connexion
              </button>
            </div>
          </form>
        )}

        {/* 5. RESET PASSWORD */}
        {view === 'reset-password' && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Code reçu par e-mail
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                style={{ width: '100%', height: '2.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.9375rem', padding: '0 0.875rem' }}
                placeholder="Code à 6 chiffres"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                Nouveau mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                  <FontAwesomeIcon icon={faKey} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.25rem', height: '2.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.9375rem' }}
                  placeholder="Nouveau mot de passe"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="pf-btn pf-btn-primary"
              style={{ width: '100%', height: '2.875rem', borderRadius: '0.5rem', fontWeight: 700 }}
            >
              <span>{isLoading ? 'Mise à jour...' : 'Enregistrer le mot de passe'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};