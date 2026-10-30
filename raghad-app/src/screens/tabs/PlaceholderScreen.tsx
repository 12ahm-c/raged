import { Text, View } from 'react-native';
import { commonStyles } from '../../components/ui/States';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={[commonStyles.screen, { justifyContent: 'center' }]}>
      <View style={commonStyles.content}>
        <Text style={commonStyles.title}>{title}</Text>
        <Text style={commonStyles.body}>
          هذه الصفحة جاهزة للتنقل، وسيُضاف محتواها في مرحلتها المحددة.
        </Text>
      </View>
    </View>
  );
}
