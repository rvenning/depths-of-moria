import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { /** changes when the player moves to another screen, which clears a caught error */ resetKey?: string; onLeave?: () => void; children: ReactNode }
interface State { error: Error | null }

/** a render error on one screen should cost that screen, not a blank page and a restart (the save is untouched, so reloading is always safe) */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('screen crashed', error, info.componentStack); }
  componentDidUpdate(prev: Props): void { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center" style={{ padding: '3rem', display: 'grid', gap: '1rem', justifyItems: 'center' }} role="alert">
        <h3>That screen hit a problem</h3>
        <p className="dim small">Your progress is saved. {this.state.error.message.slice(0, 140)}</p>
        <div className="row" style={{ gap: '.6rem' }}>
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
          {this.props.onLeave && <button className="btn" onClick={() => { this.setState({ error: null }); this.props.onLeave?.(); }}>Back to camp</button>}
          <button className="btn primary" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
