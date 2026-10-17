import { useAuth } from '../auth/AuthContext.jsx'
import ChangePasswordForm from '../components/settings/ChangePasswordForm.jsx'
import UserManager from '../components/settings/UserManager.jsx'

const ROLE_LABEL = { admin: 'Administrateur', analyste: 'Analyste vidéo', entraineur: 'Entraîneur' }

export default function Settings() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Paramètres</h1>
        <p className="mt-2 text-chalk-muted">Votre compte{user.role === 'admin' ? ' et les utilisateurs de la plateforme' : ''}.</p>
      </div>

      <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
        <h2 className="font-display text-lg font-semibold">Mon compte</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-chalk-muted">Nom</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-chalk-muted">Adresse e-mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="text-chalk-muted">Rôle</dt>
            <dd>{ROLE_LABEL[user.role]}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
        <h2 className="font-display text-lg font-semibold">Changer mon mot de passe</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      {user.role === 'admin' && (
        <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
          <h2 className="font-display text-lg font-semibold">Utilisateurs</h2>
          <div className="mt-4">
            <UserManager currentUserId={user.id} />
          </div>
        </section>
      )}
    </div>
  )
}
