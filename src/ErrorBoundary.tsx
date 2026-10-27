import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto mt-20 max-w-md p-4 text-center">
        <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
        <p className="mb-4 text-sm text-slate-600">{this.state.error.message}</p>
        <button className="rounded bg-slate-800 px-3 py-1 text-white" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}
