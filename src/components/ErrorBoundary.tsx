import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: '20px', border: '1px solid #d9534f', borderRadius: '8px', backgroundColor: '#f2dede', color: '#a94442', margin: '20px' }}>
          <h1 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>Something went wrong.</h1>
          <p>An unexpected error has occurred. Please try refreshing the page or contact support if the problem persists.</p>
          {import.meta.env.MODE === 'development' && (
            <details style={{ marginTop: '20px', backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '10px', color: '#333' }}>
                {this.state.error?.toString()}
                <br />
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;