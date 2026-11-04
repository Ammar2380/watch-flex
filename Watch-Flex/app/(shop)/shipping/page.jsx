import { Shipping } from '@/components/InfoPage';
import OrderTracker from '@/components/OrderTracker';
export const metadata = { title: 'Shipping & returns' };
export default function Page() { return <><Shipping /><div className="pg"><OrderTracker /></div></>; }
