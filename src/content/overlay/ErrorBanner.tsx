interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div data-testid="error-banner" role="alert" style={{ color: '#c0392b', padding: '8px 0' }}>
      <strong>Error:</strong> {message}
    </div>
  );
}
