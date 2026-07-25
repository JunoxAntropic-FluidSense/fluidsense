import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("FluidSense crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-fog-50 px-6">
          <div className="max-w-sm text-center space-y-4">
            <p className="text-3xl" aria-hidden="true">
              ⚠️
            </p>
            <h1 className="text-lg font-extrabold text-navy-900">
              Something went wrong
            </h1>
            <p className="text-sm text-fog-600">
              FluidSense hit an unexpected error. Your saved data is untouched —
              try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="min-h-11 px-5 rounded-xl bg-intake-600 text-white font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
