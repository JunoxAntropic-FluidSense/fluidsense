import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export function EmptyToday() {
  return (
    <Card className="p-6 text-center space-y-4">
      <p className="text-3xl" aria-hidden="true">
        💧
      </p>
      <div>
        <h2 className="text-lg font-extrabold text-navy-900">
          No fluid events recorded yet
        </h2>
        <p className="text-sm text-fog-600 mt-1">
          Record an intake or output using a quick button or voice.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Link to="/add/intake">
          <Button fullWidth variant="secondary">
            Add intake
          </Button>
        </Link>
        <Link to="/add/output">
          <Button fullWidth variant="secondary">
            Add output
          </Button>
        </Link>
        <Link to="/voice">
          <Button fullWidth>Speak an entry</Button>
        </Link>
      </div>
    </Card>
  );
}
