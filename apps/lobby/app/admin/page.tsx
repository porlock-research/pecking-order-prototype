import { GameStatus } from "@pecking-order/shared-types";

export default function AdminPage() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>System Status: {GameStatus.OPEN}</p>
      {/* TODO: Connect to Admin API */}
    </div>
  );
}
