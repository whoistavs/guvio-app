import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Compass, Home, Search, Shirt, SquarePlus, User } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

const ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "wardrobe", label: "Guarda-roupa", icon: Shirt },
  { id: "add", label: "", icon: SquarePlus, center: true },
  { id: "search", label: "Buscar", icon: Search },
  { id: "profile", label: "Perfil", icon: User },
];

export function BottomNavLiquid({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const { dark, colors } = useAppTheme();
  const [width, setWidth] = useState(360);
  const bubbleX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const activeIndex = Math.max(0, ITEMS.findIndex(i => i.id === activeTab));
  const itemWidth = width / ITEMS.length;

  const springTo = (index: number) => Animated.spring(bubbleX, { toValue: index * itemWidth, damping: 15, stiffness: 170, mass: .7, useNativeDriver: true }).start();
  useEffect(() => { springTo(activeIndex); }, [activeIndex, itemWidth]);

  const squeeze = (on: boolean) => Animated.parallel([
    Animated.spring(scaleX, { toValue: on ? 1.24 : 1, damping: 13, stiffness: 220, useNativeDriver: true }),
    Animated.spring(scaleY, { toValue: on ? .82 : 1, damping: 13, stiffness: 220, useNativeDriver: true }),
  ]).start();

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
    onPanResponderGrant: (e) => { squeeze(true); bubbleX.stopAnimation(); const x = e.nativeEvent.locationX - itemWidth/2; bubbleX.setValue(Math.max(0, Math.min(width-itemWidth, x))); },
    onPanResponderMove: (e) => { const x = e.nativeEvent.locationX - itemWidth/2; bubbleX.setValue(Math.max(0, Math.min(width-itemWidth, x))); },
    onPanResponderRelease: (e) => { squeeze(false); const idx = Math.max(0, Math.min(ITEMS.length-1, Math.round((e.nativeEvent.locationX-itemWidth/2)/itemWidth))); springTo(idx); onTabChange(ITEMS[idx].id); },
    onPanResponderTerminate: () => { squeeze(false); springTo(activeIndex); },
  }), [width, itemWidth, activeIndex]);

  return <View style={styles.fixed} pointerEvents="box-none">
    <View style={[styles.shell, { backgroundColor: colors.glass, borderColor: dark ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.9)" }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <BlurView intensity={dark ? 48 : 78} tint={dark ? "dark" : "light"} style={styles.blur} {...responder.panHandlers}>
        <Animated.View pointerEvents="none" style={[styles.bubbleSlot,{width:itemWidth,transform:[{translateX:bubbleX},{scaleX},{scaleY}]}]}>
          <View style={[styles.bubble,{backgroundColor:dark?"rgba(255,255,255,.13)":"rgba(255,255,255,.52)",borderColor:dark?"rgba(255,255,255,.24)":"rgba(255,255,255,.98)"}]}>
            <View style={styles.highlight}/><View style={styles.refraction}/>
          </View>
        </Animated.View>
        <View style={styles.row} pointerEvents="box-none">{ITEMS.map((it,idx)=>{const Icon=it.icon; const active=idx===activeIndex; return <Pressable key={it.id} onPress={()=>onTabChange(it.id)} onPressIn={()=>squeeze(true)} onPressOut={()=>squeeze(false)} style={[styles.item,{width:itemWidth}]}>
          {it.center ? <View style={[styles.center,{backgroundColor:colors.text}]}><SquarePlus size={22} color={colors.bg}/></View> : <><Icon size={20} color={active?colors.text:colors.muted} fill={active&&it.id==="home"?colors.text:"none"}/><Text style={[styles.label,{color:active?colors.text:colors.muted}]}>{it.label}</Text></>}
        </Pressable>})}</View>
      </BlurView>
    </View>
  </View>
}

const styles=StyleSheet.create({
  fixed:{position:Platform.OS==="web"?("fixed" as any):"absolute",bottom:Platform.OS==="ios"?20:12,left:0,right:0,alignItems:"center",zIndex:999},
  shell:{width:"92%",maxWidth:440,borderRadius:34,overflow:"hidden",borderWidth:StyleSheet.hairlineWidth,shadowColor:"#000",shadowOffset:{width:0,height:9},shadowOpacity:.16,shadowRadius:24,elevation:14},
  blur:{paddingVertical:8,overflow:"hidden"},bubbleSlot:{position:"absolute",left:0,top:5,bottom:5,paddingHorizontal:5},
  bubble:{flex:1,borderRadius:29,borderWidth:StyleSheet.hairlineWidth,overflow:"hidden",shadowColor:"#000",shadowOffset:{width:0,height:5},shadowOpacity:.1,shadowRadius:12},
  highlight:{position:"absolute",top:3,left:"18%",right:"18%",height:6,borderRadius:999,backgroundColor:"rgba(255,255,255,.76)"},
  refraction:{position:"absolute",bottom:-8,left:"8%",right:"8%",height:20,borderRadius:999,backgroundColor:"rgba(170,220,255,.13)"},
  row:{flexDirection:"row",alignItems:"center",zIndex:2},item:{minHeight:54,alignItems:"center",justifyContent:"center",gap:3},label:{fontSize:9.5,fontWeight:"600"},center:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center"}
});
