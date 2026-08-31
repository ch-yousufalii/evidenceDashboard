# Sales Dashboard

Live data from the Railway Postgres database.

## Filters

{% date_grain_selector
  id="time_grain"
  default_value="day"
  preset_values=["day", "week", "month"]
/%}

{% range_calendar id="date_filter" /%}

{% dropdown
  id="customer_filter"
  data="customers_list"
  value_column="customer"
/%}

{% dropdown
  id="product_filter"
  data="products_list"
  value_column="product"
/%}

## KPIs

```sql kpis
select
  coalesce(sum(total), 0) as total_sales,
  coalesce(round(avg(aov)), 0) as avg_order_value,
  (select count(*) from sales_records where date::date {{date_filter.between}}) as orders,
  (select count(*) from pre_orders) as pre_orders
from sales_daily
where date::date {{date_filter.between}}
```

{% big_value data="kpis" value="max(total_sales)" fmt="usd" title="Total Sales" /%}

{% big_value data="kpis" value="max(avg_order_value)" fmt="usd" title="Avg Order Value" /%}

{% big_value data="kpis" value="max(orders)" fmt="num" title="Orders" /%}

{% big_value data="kpis" value="max(pre_orders)" fmt="num" title="Pre-Orders" /%}

## Daily Sales

```sql daily_sales
select
  date_trunc({{time_grain}}, date::date) as period,
  sum(total) as sales,
  avg(aov) as aov
from sales_daily
where date::date {{date_filter.between}}
group by 1
order by 1
```

{% line_chart
  data="daily_sales"
  x="period"
  y="sum(sales)"
  title="Revenue per Day"
/%}

{% bar_chart
  data="daily_sales"
  x="period"
  y="sum(sales)"
  title="Revenue per Day (Bars)"
/%}

## Average Order Value Trend

{% line_chart
  data="daily_sales"
  x="period"
  y="avg(aov)"
  title="AOV per Day"
/%}

## Top Customers

```sql customers_list
select distinct customer from sales_records order by 1
```

```sql top_customers
select
  customer,
  sum(total) as spent,
  count(*) as orders
from sales_records
where {{customer_filter.filter}}
group by 1
order by spent desc
```

{% bar_chart
  data="top_customers"
  x="customer"
  y="sum(spent)"
  title="Spend by Customer"
/%}

## Pre-Orders

```sql products_list
select distinct product from pre_orders order by 1
```

```sql pre_order_pipeline
select
  product,
  orders,
  status,
  progress,
  expected,
  shipping
from pre_orders
where {{product_filter.filter}}
order by updated_at desc
```

```sql pre_orders_by_product
select
  product,
  sum(orders) as orders
from pre_orders
where {{product_filter.filter}}
group by 1
order by orders desc
```

```sql pre_orders_by_status
select
  status,
  count(*) as items
from pre_orders
where {{product_filter.filter}}
group by 1
order by items desc
```

{% bar_chart
  data="pre_orders_by_product"
  x="product"
  y="sum(orders)"
  title="Pre-Orders by Product"
/%}

{% pie_chart
  data="pre_orders_by_status"
  category="status"
  value="sum(items)"
  title="Pipeline by Status"
/%}

{% table data="pre_order_pipeline" /%}

## Monthly Profit

```sql monthly_profit
select
  p->>'m' as month,
  (p->>'profit')::int as profit
from cost_profit,
     jsonb_array_elements(monthly_profit) p
order by array_position(array['Mar','Apr','May','Jun','Jul','Aug'], p->>'m')
```

{% line_chart
  data="monthly_profit"
  x="month"
  y="sum(profit)"
  title="Profit by Month"
/%}

## Cost Breakdown

```sql cost_breakdown
select
  b->>'label' as category,
  (b->>'value')::int as value
from cost_profit,
     jsonb_array_elements(breakdown) b
order by value desc
```

{% pie_chart
  data="cost_breakdown"
  category="category"
  value="sum(value)"
  title="Where the Money Goes"
/%}

```sql cost_revenue
select 'Monthly Cost' as category, sum(monthly_cost) as value from cost_profit
union all
select 'Estimated Revenue' as category, sum(estimated_revenue) as value from cost_profit
```

{% bar_chart
  data="cost_revenue"
  x="category"
  y="sum(value)"
  order="sum(value) desc"
  title="Cost vs Revenue"
/%}

## Shipment Tracking

```sql shipments
select
  number,
  carrier,
  product,
  status,
  eta
from tracking
order by updated_at desc
```

```sql shipments_by_carrier
select
  carrier,
  count(*) as shipments
from tracking
group by 1
order by shipments desc
```

{% pie_chart
  data="shipments_by_carrier"
  category="carrier"
  value="sum(shipments)"
  title="Shipments by Carrier"
/%}

{% table data="shipments" /%}

## Team

```sql team_directory
select
  pr.full_name,
  m.role,
  w.name as workspace,
  m.created_at::date as joined
from members m
join profiles pr on pr.user_id = m.user_id
join workspaces w on w.id = m.workspace_id
order by m.created_at
```

{% table data="team_directory" /%}

## Recent Orders

```sql recent_orders
select
  order_id,
  customer,
  items,
  total,
  date::date as date
from sales_records
where {{customer_filter.filter}}
order by created_at desc
limit 20
```

{% table data="recent_orders" /%}
