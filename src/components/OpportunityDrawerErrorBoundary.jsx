import { Component } from 'react'

/** Isolates detail-only render failures from the rest of the workspace. */
export default class OpportunityDrawerErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Opportunity details failed to render', error)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.opportunityId !== this.props.opportunityId && this.state.failed) {
      // New opportunity: allow the drawer to render again.
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return <div role="alert" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 p-6 text-white">
          <h2 className="font-bold text-lg">Opportunity details unavailable</h2>
          <p className="my-3 text-sm text-slate-300">The detail view encountered a problem. Your workspace and opportunity data are still available.</p>
          <button type="button" onClick={this.props.onClose}
            className="rounded-lg bg-violet-700 px-4 py-2 font-semibold">Close details</button>
        </div>
      </div>
    }
    return this.props.children
  }
}
