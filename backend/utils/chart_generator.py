import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from collections import Counter
from io import BytesIO


def create_pie_chart(data_rows):
    """Create a pie chart for crime categories distribution."""
    crime_counts = Counter()
    for row in data_rows:
        category = row.get('main_crime_category') or 'None'
        crime_counts[category] += 1
    
    labels = list(crime_counts.keys())
    sizes = list(crime_counts.values())
    colors_list = ['#1d4ed8', '#f97316', '#22c55e', '#ef4444', '#0ea5e9', '#a855f7']
    
    fig, ax = plt.subplots(figsize=(8, 6))
    wedges, texts, autotexts = ax.pie(sizes, labels=None, autopct='%1.1f%%',
                                        colors=colors_list[:len(labels)], startangle=90)
    
    # Create legend on the left side
    ax.legend(wedges, labels, title="Crime Categories", loc="center left", bbox_to_anchor=(1, 0, 0.5, 1))
    ax.axis('equal')
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()
    return buf


def create_bar_chart(data_rows, report_type):
    """Create a bar chart for population or avg crime weight."""
    labels = [row.get('neighbourhood_name', '') for row in data_rows]
    
    if report_type == 'crime':
        values = [float(row.get('population', 0)) for row in data_rows]
        ylabel = 'Population (thousands)'
        title = 'Population per Neighbourhood'
    else:
        values = [float(row.get('avg_crime_weight', 0)) for row in data_rows]
        ylabel = 'Avg Crime Weight'
        title = 'Avg Crime Weight per Neighbourhood'
    
    colors_list = ['#4f46e5', '#f59e0b', '#f97373', '#22c55e', '#0ea5e9', '#a855f7']
    bar_colors = [colors_list[i % len(colors_list)] for i in range(len(labels))]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(labels, values, color=bar_colors)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()
    return buf


def create_line_chart(data_rows, report_type):
    """Create a line chart for unemployment or avg crime weight trend."""
    labels = [row.get('neighbourhood_name', '') for row in data_rows]
    
    if report_type == 'crime':
        values = [float(row.get('unemployment_percent', 0)) for row in data_rows]
        ylabel = 'Unemployment %'
        title = 'Unemployment vs Neighbourhood'
        color = '#10b981'
    else:
        values = [float(row.get('avg_crime_weight', 0)) for row in data_rows]
        ylabel = 'Avg Crime Weight'
        title = 'Avg Crime Weight Trend'
        color = '#ef4444'
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(labels, values, marker='o', color=color, linewidth=2)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    plt.xticks(rotation=45, ha='right')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()
    return buf