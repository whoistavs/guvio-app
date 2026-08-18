import React,{useEffect,useMemo,useState}from"react";
import{ActivityIndicator,StyleSheet,Text,TextInput,TouchableOpacity,View}from"react-native";
import{Globe2,MapPin,Search,X}from"lucide-react-native";
import{COUNTRIES}from"../data/mockData";
import{GeoSearchItem,searchCountriesDev}from"../services/countriesDev";
import{useAppTheme}from"../context/AppTheme";

export type GlobeSearchSelection={type:"country"|"city"|"region";label:string;subtitle?:string;lat:number;lon:number;countryName?:string};
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

export function GlobeLocationSearch({onSelect}:{onSelect:(x:GlobeSearchSelection)=>void}){
  const{colors}=useAppTheme();
  const[q,setQ]=useState("");
  const[focus,setFocus]=useState(false);
  const[remote,setRemote]=useState<GeoSearchItem[]>([]);
  const[loading,setLoading]=useState(false);
  const[remoteFailed,setRemoteFailed]=useState(false);

  const local=useMemo(()=>{
    const n=norm(q);
    if(!n)return[];
    const out:GeoSearchItem[]=[];
    for(const c of COUNTRIES){
      if(norm(c.name).includes(n))out.push({id:`local-country-${c.id}`,label:c.name,subtitle:"País",type:"country",lat:c.lat,lon:c.lon,countryName:c.name});
      for(const city of c.cities){
        if(norm(`${city.name} ${c.name}`).includes(n))out.push({id:`local-city-${city.id}`,label:city.name,subtitle:c.name,type:"city",lat:city.lat,lon:city.lon,countryName:c.name});
      }
    }
    return out.slice(0,8);
  },[q]);

  useEffect(()=>{
    if(q.trim().length<2){setRemote([]);setRemoteFailed(false);return}
    let cancelled=false;
    const t=setTimeout(async()=>{
      setLoading(true);
      setRemoteFailed(false);
      try{
        const result=await searchCountriesDev(q);
        if(!cancelled)setRemote(result);
      }catch{
        if(!cancelled){setRemote([]);setRemoteFailed(true)}
      }finally{
        if(!cancelled)setLoading(false);
      }
    },260);
    return()=>{cancelled=true;clearTimeout(t)};
  },[q]);

  const items=useMemo(()=>{
    const merged=[...remote,...local];
    const seen=new Set<string>();
    return merged.filter(it=>{
      const key=`${it.type}:${norm(it.label)}:${norm(it.subtitle||"")}`;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    }).slice(0,10);
  },[remote,local]);

  const choose=(it:GeoSearchItem)=>{
    setQ(`${it.label}${it.subtitle&&it.subtitle!=="País"?`, ${it.subtitle}`:""}`);
    setFocus(false);
    onSelect({type:it.type,label:it.label,subtitle:it.subtitle,lat:it.lat,lon:it.lon,countryName:it.countryName||it.subtitle});
  };

  return <View style={styles.wrap}>
    <View style={[styles.bar,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <Search size={18} color={colors.muted}/>
      <TextInput value={q} onChangeText={setQ} onFocus={()=>setFocus(true)} placeholder="Pesquisar cidade ou país" placeholderTextColor={colors.muted} style={[styles.input,{color:colors.text}]}/>
      {loading?<ActivityIndicator size="small"/>:!!q&&<TouchableOpacity onPress={()=>{setQ("");setRemote([])}}><X size={15} color={colors.muted}/></TouchableOpacity>}
    </View>
    {focus&&q.length>0&&<View style={[styles.results,{backgroundColor:colors.glassStrong,borderColor:colors.border}]}>
      {items.length?items.map((it)=><TouchableOpacity key={it.id} style={styles.row} onPress={()=>choose(it)}>
        <View style={[styles.ico,{backgroundColor:colors.surface2}]}>{it.type==="city"?<MapPin size={16} color={colors.icon}/>:<Globe2 size={16} color={colors.icon}/>}</View>
        <View style={{flex:1}}><Text style={[styles.title,{color:colors.text}]}>{it.label}</Text><Text style={[styles.sub,{color:colors.muted}]}>{it.subtitle||it.type}</Text></View>
      </TouchableOpacity>):<View style={styles.empty}><Text style={{color:colors.muted}}>{loading?"Buscando lugares…":"Nenhum lugar encontrado"}</Text></View>}
      <Text style={[styles.source,{color:colors.muted}]}>{remoteFailed?"Sem conexão — mostrando resultados locais":"Dados geográficos: countries.dev"}</Text>
    </View>}
  </View>
}

const styles=StyleSheet.create({wrap:{width:"100%",maxWidth:430,zIndex:50,paddingHorizontal:20,marginBottom:10},bar:{height:48,borderRadius:24,borderWidth:1,flexDirection:"row",alignItems:"center",paddingHorizontal:16,gap:10},input:{flex:1,height:"100%",fontSize:14,outlineStyle:"none"}as any,results:{position:"absolute",top:54,left:20,right:20,borderRadius:20,borderWidth:1,paddingVertical:6,shadowColor:"#000",shadowOffset:{width:0,height:10},shadowOpacity:.12,shadowRadius:22,elevation:10,overflow:"hidden"},row:{minHeight:55,flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:7},ico:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",marginRight:10},title:{fontSize:14,fontWeight:"700"},sub:{fontSize:11,marginTop:2},empty:{padding:18,alignItems:"center"},source:{fontSize:9,paddingHorizontal:14,paddingVertical:7,textAlign:"right"}});
