import { Link } from 'react-router-dom';

const LOGO_SRC = '/logo-dark.png';

/** Body of the centred card shown when a public emailed link (invite, set
 *  password) can't be used — branded, says what to do next, never a bare
 *  developer-style message. */
export function LinkProblemCard({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="text-center">
      <img src={LOGO_SRC} alt="Stone Suite logo" className="mx-auto mb-4 h-14 w-auto object-contain" />
      <h1 className="text-lg font-bold text-stone-900">{title}</h1>
      <p className="mt-2 text-sm text-stone-600">{message}</p>
      <Link
        to="/auth/login"
        aria-label="Go to sign in"
        className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-brand/80"
      >
        Go to sign in
      </Link>
    </div>
  );
}
