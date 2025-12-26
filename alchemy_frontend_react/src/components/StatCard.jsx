import { Card, CardBody, Typography } from "@material-tailwind/react";

export default function StatCard({ title, value, icon: Icon, color = "blue" }) {
  return (
    <Card className="glass-panel trend-card">
      <CardBody className="flex items-center gap-4">
        <div className={`grid h-12 w-12 place-items-center rounded-lg bg-${color}-100 text-${color}-700 shadow-inner bg-gradient-to-br from-secondary/20 to-accent/20`}>
          {Icon && <Icon className="h-6 w-6" />}
        </div>
        <div>
          <Typography variant="small" className="text-gray-600">{title}</Typography>
      <Typography variant="h5" className="mt-1 text-emerald-700 font-semibold">{value}</Typography>
        </div>
      </CardBody>
    </Card>
  );
}